use std::collections::BTreeMap;
use std::path::Path;

use image::imageops::FilterType;
use tauri::State;

use crate::error::AppError;
use crate::model::{FileEntry, PairGroup, SimilarityCluster, SimilarityKind};
use crate::preview;
use crate::state::AppState;

const BURST_WINDOW_MS: i64 = 2_000;
const SIMILAR_WINDOW_MS: i64 = 30_000;
const HASH_DISTANCE_LIMIT: u32 = 8;

#[derive(Clone)]
struct Candidate {
    group_id: String,
    dir: String,
    mtime_ms: i64,
    hash: Option<u64>,
}

fn representative(group: &PairGroup) -> Option<&FileEntry> {
    group.others.first().or_else(|| group.raws.first())
}

fn average_hash(file: &FileEntry) -> Option<u64> {
    let bytes = preview::generate_thumbnail(Path::new(&file.path), file.kind).ok()?;
    let image = image::load_from_memory(&bytes).ok()?.to_luma8();
    let small = image::imageops::resize(&image, 8, 8, FilterType::Triangle);
    let average = small.pixels().map(|pixel| pixel.0[0] as u32).sum::<u32>() / 64;
    Some(
        small
            .pixels()
            .enumerate()
            .fold(0u64, |hash, (index, pixel)| {
                if pixel.0[0] as u32 >= average {
                    hash | (1u64 << index)
                } else {
                    hash
                }
            }),
    )
}

fn find(parent: &mut [usize], index: usize) -> usize {
    if parent[index] != index {
        parent[index] = find(parent, parent[index]);
    }
    parent[index]
}

fn union(parent: &mut [usize], a: usize, b: usize) {
    let a = find(parent, a);
    let b = find(parent, b);
    if a != b {
        parent[b] = a;
    }
}

pub fn analyze(groups: &[PairGroup]) -> Vec<SimilarityCluster> {
    let mut candidates: Vec<Candidate> = groups
        .iter()
        .filter_map(|group| {
            let file = representative(group)?;
            Some(Candidate {
                group_id: group.id.clone(),
                dir: group.dir.clone(),
                mtime_ms: file.mtime_ms,
                hash: average_hash(file),
            })
        })
        .collect();
    candidates.sort_by_key(|candidate| candidate.mtime_ms);
    let mut parent: Vec<usize> = (0..candidates.len()).collect();

    for i in 0..candidates.len() {
        for j in (i + 1)..candidates.len() {
            let delta = candidates[j].mtime_ms - candidates[i].mtime_ms;
            if delta > SIMILAR_WINDOW_MS {
                break;
            }
            if candidates[i].dir != candidates[j].dir {
                continue;
            }
            let burst = delta <= BURST_WINDOW_MS;
            let visually_similar = candidates[i]
                .hash
                .zip(candidates[j].hash)
                .is_some_and(|(a, b)| (a ^ b).count_ones() <= HASH_DISTANCE_LIMIT);
            if burst || visually_similar {
                union(&mut parent, i, j);
            }
        }
    }

    let mut members: BTreeMap<usize, Vec<usize>> = BTreeMap::new();
    for index in 0..candidates.len() {
        let root = find(&mut parent, index);
        members.entry(root).or_default().push(index);
    }
    members
        .into_values()
        .filter(|indices| indices.len() >= 2)
        .map(|indices| {
            let mut min_distance = 64u32;
            let mut near_duplicate = false;
            for (position, &i) in indices.iter().enumerate() {
                for &j in &indices[position + 1..] {
                    if let Some((a, b)) = candidates[i].hash.zip(candidates[j].hash) {
                        let distance = (a ^ b).count_ones();
                        min_distance = min_distance.min(distance);
                        near_duplicate |= distance <= HASH_DISTANCE_LIMIT;
                    }
                }
            }
            let group_ids: Vec<String> = indices
                .iter()
                .map(|&index| candidates[index].group_id.clone())
                .collect();
            let id = blake3::hash(group_ids.join("|").as_bytes())
                .to_hex()
                .to_string();
            SimilarityCluster {
                id,
                kind: if near_duplicate {
                    SimilarityKind::NearDuplicate
                } else {
                    SimilarityKind::Burst
                },
                group_ids,
                score: 1.0 - min_distance as f32 / 64.0,
            }
        })
        .collect()
}

#[tauri::command]
pub async fn analyze_similar_groups(
    state: State<'_, AppState>,
) -> Result<Vec<SimilarityCluster>, AppError> {
    let groups = state.groups.read().expect("groups lock poisoned").clone();
    tauri::async_runtime::spawn_blocking(move || analyze(&groups))
        .await
        .map_err(|error| AppError::Other(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{FileKind, GroupStatus};

    fn group(path: String, id: &str, mtime_ms: i64) -> PairGroup {
        PairGroup {
            id: id.into(),
            dir: Path::new(&path)
                .parent()
                .unwrap()
                .to_string_lossy()
                .into_owned(),
            base_name: id.into(),
            raws: Vec::new(),
            others: vec![FileEntry {
                file_name: Path::new(&path)
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned(),
                path,
                ext: "png".into(),
                kind: FileKind::NonRaw,
                size: 1,
                mtime_ms,
            }],
            status: GroupStatus::NonRawOnly,
        }
    }

    #[test]
    fn hamming_distance_detects_small_visual_change() {
        assert_eq!((0b1010u64 ^ 0b1011u64).count_ones(), 1);
        assert!((0b1010u64 ^ 0b1011u64).count_ones() <= HASH_DISTANCE_LIMIT);
    }

    #[test]
    fn identical_images_form_near_duplicate_cluster() {
        let temp = tempfile::tempdir().unwrap();
        let first = temp.path().join("first.png");
        let second = temp.path().join("second.png");
        let image = image::GrayImage::from_fn(16, 16, |x, _| image::Luma([(x * 8) as u8]));
        image.save(&first).unwrap();
        image.save(&second).unwrap();
        let groups = vec![
            group(first.to_string_lossy().into_owned(), "first", 10_000),
            group(second.to_string_lossy().into_owned(), "second", 20_000),
        ];
        let clusters = analyze(&groups);
        assert_eq!(clusters.len(), 1);
        assert!(matches!(clusters[0].kind, SimilarityKind::NearDuplicate));
    }

    #[test]
    fn close_file_times_form_burst_even_when_preview_fails() {
        let temp = tempfile::tempdir().unwrap();
        let groups = vec![
            group(
                temp.path()
                    .join("missing-a.png")
                    .to_string_lossy()
                    .into_owned(),
                "a",
                100,
            ),
            group(
                temp.path()
                    .join("missing-b.png")
                    .to_string_lossy()
                    .into_owned(),
                "b",
                600,
            ),
        ];
        let clusters = analyze(&groups);
        assert_eq!(clusters.len(), 1);
        assert!(matches!(clusters[0].kind, SimilarityKind::Burst));
    }
}
