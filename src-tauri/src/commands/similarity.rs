use std::collections::{BTreeMap, HashMap};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use image::imageops::FilterType;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::config::AppConfig;
use crate::error::AppError;
use crate::exif;
use crate::model::{FileEntry, PairGroup, SimilarityCluster, SimilarityKind};
use crate::preview;
use crate::state::AppState;
use crate::thumbs;

#[derive(Clone)]
struct Candidate {
    group_id: String,
    dir: String,
    capture_ms: i64,
    hash: Option<u64>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SimilarityProgress {
    job_id: u64,
    done: usize,
    total: usize,
    stage: &'static str,
}

fn representative(group: &PairGroup) -> Option<&FileEntry> {
    group.others.first().or_else(|| group.raws.first())
}

fn difference_hash(file: &FileEntry) -> Option<u64> {
    let bytes = preview::generate_thumbnail(Path::new(&file.path), file.kind).ok()?;
    let image = image::load_from_memory(&bytes).ok()?.to_luma8();
    let small = image::imageops::resize(&image, 9, 8, FilterType::Triangle);
    let mut hash = 0u64;
    for y in 0..8 {
        for x in 0..8 {
            if small.get_pixel(x, y).0[0] > small.get_pixel(x + 1, y).0[0] {
                hash |= 1u64 << (y * 8 + x);
            }
        }
    }
    Some(hash)
}

fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let year = year - i64::from(month <= 2);
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let year_of_era = year - era * 400;
    let shifted_month = month + if month > 2 { -3 } else { 9 };
    let day_of_year = (153 * shifted_month + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

fn exif_time_ms(value: &str) -> Option<i64> {
    let parts: Vec<i64> = value
        .split(|character: char| !character.is_ascii_digit())
        .filter(|part| !part.is_empty())
        .take(6)
        .map(str::parse)
        .collect::<Result<_, _>>()
        .ok()?;
    if parts.len() != 6 || !(1..=12).contains(&parts[1]) || !(1..=31).contains(&parts[2]) {
        return None;
    }
    Some(
        (days_from_civil(parts[0], parts[1], parts[2]) * 86_400
            + parts[3] * 3_600
            + parts[4] * 60
            + parts[5])
            * 1_000,
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

fn ensure_current(generation: &AtomicU64, job_id: u64) -> Result<(), AppError> {
    if generation.load(Ordering::SeqCst) == job_id {
        Ok(())
    } else {
        Err(AppError::Other("similarity analysis cancelled".into()))
    }
}

fn analyze(
    groups: &[PairGroup],
    config: &AppConfig,
    cache: &mut HashMap<String, u64>,
    generation: &AtomicU64,
    job_id: u64,
    mut on_progress: impl FnMut(usize, usize, &'static str),
) -> Result<Vec<SimilarityCluster>, AppError> {
    let total = groups.len();
    let mut candidates = Vec::with_capacity(total);
    for (index, group) in groups.iter().enumerate() {
        ensure_current(generation, job_id)?;
        let Some(file) = representative(group) else {
            continue;
        };
        let cache_key = thumbs::cache_file_name(Path::new(&file.path)).unwrap_or_else(|_| {
            blake3::hash(format!("{}|{}|{}", file.path, file.mtime_ms, file.size).as_bytes())
                .to_hex()
                .to_string()
        });
        let hash = cache.get(&cache_key).copied().or_else(|| {
            let value = difference_hash(file)?;
            cache.insert(cache_key, value);
            Some(value)
        });
        let capture_ms = exif::read_exif(Path::new(&file.path), file.kind)
            .date_taken
            .as_deref()
            .and_then(exif_time_ms)
            .unwrap_or(file.mtime_ms);
        candidates.push(Candidate {
            group_id: group.id.clone(),
            dir: group.dir.clone(),
            capture_ms,
            hash,
        });
        on_progress(index + 1, total, "hashing");
    }

    candidates.sort_by_key(|candidate| candidate.capture_ms);
    let mut parent: Vec<usize> = (0..candidates.len()).collect();
    for i in 0..candidates.len() {
        ensure_current(generation, job_id)?;
        for j in (i + 1)..candidates.len() {
            let delta = candidates[j].capture_ms - candidates[i].capture_ms;
            if delta > config.similarity_window_ms {
                break;
            }
            if candidates[i].dir != candidates[j].dir {
                continue;
            }
            let burst = delta <= config.similarity_burst_window_ms;
            let visually_similar = candidates[i]
                .hash
                .zip(candidates[j].hash)
                .is_some_and(|(a, b)| (a ^ b).count_ones() <= config.similarity_hash_distance);
            if burst || visually_similar {
                union(&mut parent, i, j);
            }
        }
        on_progress(i + 1, candidates.len(), "grouping");
    }

    let mut members: BTreeMap<usize, Vec<usize>> = BTreeMap::new();
    for index in 0..candidates.len() {
        let root = find(&mut parent, index);
        members.entry(root).or_default().push(index);
    }
    Ok(members
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
                        near_duplicate |= distance <= config.similarity_hash_distance;
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
                score: if min_distance == 64 {
                    0.0
                } else {
                    1.0 - min_distance as f32 / 64.0
                },
            }
        })
        .collect())
}

#[tauri::command]
pub async fn cancel_similarity_analysis(state: State<'_, AppState>) -> Result<(), AppError> {
    state.next_similarity_generation();
    Ok(())
}

#[tauri::command]
pub async fn analyze_similar_groups(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<SimilarityCluster>, AppError> {
    let groups = state.groups.read().expect("groups lock poisoned").clone();
    let config = state.config.read().expect("config lock poisoned").clone();
    let (job_id, mut cache) = state.begin_similarity_job();
    let generation: Arc<AtomicU64> = Arc::clone(&state.similarity_generation);
    let progress_app = app.clone();
    let (clusters, cache) = tauri::async_runtime::spawn_blocking(move || {
        let clusters = analyze(
            &groups,
            &config,
            &mut cache,
            &generation,
            job_id,
            |done, total, stage| {
                let _ = progress_app.emit(
                    "similarity://progress",
                    SimilarityProgress {
                        job_id,
                        done,
                        total,
                        stage,
                    },
                );
            },
        )?;
        Ok::<_, AppError>((clusters, cache))
    })
    .await
    .map_err(|error| AppError::Other(error.to_string()))??;
    if !state.commit_similarity_hashes(job_id, cache)? {
        return Err(AppError::Other("similarity analysis cancelled".into()));
    }
    Ok(clusters)
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

    fn run(groups: &[PairGroup]) -> Vec<SimilarityCluster> {
        let generation = AtomicU64::new(1);
        analyze(
            groups,
            &AppConfig::default(),
            &mut HashMap::new(),
            &generation,
            1,
            |_, _, _| {},
        )
        .unwrap()
    }

    #[test]
    fn parses_exif_capture_time() {
        assert!(exif_time_ms("2026:08:11 12:34:56").is_some());
        assert!(exif_time_ms("invalid").is_none());
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
        let clusters = run(&groups);
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
        let clusters = run(&groups);
        assert_eq!(clusters.len(), 1);
        assert!(matches!(clusters[0].kind, SimilarityKind::Burst));
    }
}
