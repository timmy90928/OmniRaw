use std::collections::{BTreeMap, HashMap};
use std::path::Path;
use std::time::UNIX_EPOCH;

use walkdir::WalkDir;

use crate::config::AppConfig;
use crate::error::AppError;
use crate::model::{FileEntry, FileKind, GroupStatus, PairGroup, ScanResult};

/// Outcome of collecting files under a root, before pairing.
pub struct CollectedFiles {
    pub entries: Vec<FileEntry>,
    pub total_files: usize,
    pub skipped_files: usize,
}

/// Walks `root` recursively and classifies files by extension.
/// `on_progress` is called with the number of files seen so far (every 500).
pub fn collect_files(
    root: &Path,
    config: &AppConfig,
    mut on_progress: impl FnMut(usize),
) -> Result<CollectedFiles, AppError> {
    if !root.is_dir() {
        return Err(AppError::Other(format!(
            "not a directory: {}",
            root.display()
        )));
    }

    let mut entries = Vec::new();
    let mut total_files = 0usize;
    let mut skipped_files = 0usize;

    let walker = WalkDir::new(root).follow_links(false).into_iter();
    for item in walker.filter_entry(|e| !is_hidden(e)) {
        let item = match item {
            Ok(i) => i,
            Err(_) => {
                skipped_files += 1;
                continue;
            }
        };
        if !item.file_type().is_file() {
            continue;
        }
        total_files += 1;
        if total_files % 500 == 0 {
            on_progress(total_files);
        }

        let path = item.path();
        let ext = match path.extension().and_then(|e| e.to_str()) {
            Some(e) => e.to_lowercase(),
            None => {
                skipped_files += 1;
                continue;
            }
        };
        let kind = if config.raw_extensions.iter().any(|e| e == &ext) {
            FileKind::Raw
        } else if config.non_raw_extensions.iter().any(|e| e == &ext) {
            FileKind::NonRaw
        } else {
            skipped_files += 1;
            continue;
        };

        let meta = match item.metadata() {
            Ok(m) => m,
            Err(_) => {
                skipped_files += 1;
                continue;
            }
        };
        let mtime_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        entries.push(FileEntry {
            path: path.to_string_lossy().into_owned(),
            file_name: item.file_name().to_string_lossy().into_owned(),
            ext,
            kind,
            size: meta.len(),
            mtime_ms,
        });
    }

    Ok(CollectedFiles {
        entries,
        total_files,
        skipped_files,
    })
}

fn is_hidden(entry: &walkdir::DirEntry) -> bool {
    entry.depth() > 0
        && entry
            .file_name()
            .to_str()
            .map(|s| s.starts_with('.'))
            .unwrap_or(false)
}

fn split_dir_base(entry: &FileEntry) -> (String, String) {
    let path = Path::new(&entry.path);
    let dir = path
        .parent()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();
    let base = path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| entry.file_name.clone());
    (dir, base)
}

/// `base` is an exported variant of `raw_base` when it extends it with a
/// non-alphanumeric separator: `img_0001-1` / `img_0001_edit` match
/// `img_0001`, but `img_00010` does not. Both args must be lowercase.
fn is_export_of(base: &str, raw_base: &str) -> bool {
    base.len() > raw_base.len()
        && base.starts_with(raw_base)
        && !base.as_bytes()[raw_base.len()].is_ascii_alphanumeric()
}

/// Pure pairing function, case-insensitive on (dir, basename).
///
/// With `match_exported_suffixes`, a non-RAW file also joins a RAW group when
/// its basename is the RAW basename plus a suffix (`IMG_0001_edit.jpg` →
/// `IMG_0001.CR3`); the longest matching RAW basename wins, so
/// `IMG_0001-1-edit.jpg` prefers `IMG_0001-1.CR3` over `IMG_0001.CR3`.
/// Deterministic output order: by dir, then basename.
pub fn build_pair_groups(entries: Vec<FileEntry>, match_exported_suffixes: bool) -> Vec<PairGroup> {
    let (raw_entries, non_raw_entries): (Vec<_>, Vec<_>) =
        entries.into_iter().partition(|e| e.kind == FileKind::Raw);

    let mut map: BTreeMap<String, PairGroup> = BTreeMap::new();
    // dir_lower -> lowercase RAW basenames in that dir (for prefix lookup)
    let mut raw_bases: HashMap<String, Vec<String>> = HashMap::new();

    let mut insert = |map: &mut BTreeMap<String, PairGroup>, id: String, dir: String, base: String, entry: FileEntry| {
        let group = map.entry(id.clone()).or_insert_with(|| PairGroup {
            id,
            dir,
            base_name: base,
            raws: Vec::new(),
            others: Vec::new(),
            status: GroupStatus::Complete, // recomputed at the end
        });
        match entry.kind {
            FileKind::Raw => group.raws.push(entry),
            FileKind::NonRaw => group.others.push(entry),
        }
    };

    for entry in raw_entries {
        let (dir, base) = split_dir_base(&entry);
        let (dir_l, base_l) = (dir.to_lowercase(), base.to_lowercase());
        raw_bases.entry(dir_l.clone()).or_default().push(base_l.clone());
        insert(&mut map, format!("{dir_l}|{base_l}"), dir, base, entry);
    }

    for entry in non_raw_entries {
        let (dir, base) = split_dir_base(&entry);
        let (dir_l, base_l) = (dir.to_lowercase(), base.to_lowercase());
        let exact_id = format!("{dir_l}|{base_l}");

        let target_id = if map.contains_key(&exact_id) {
            exact_id
        } else if match_exported_suffixes {
            raw_bases
                .get(&dir_l)
                .and_then(|bases| {
                    bases
                        .iter()
                        .filter(|p| is_export_of(&base_l, p))
                        .max_by_key(|p| p.len())
                })
                .map(|p| format!("{dir_l}|{p}"))
                .unwrap_or(exact_id)
        } else {
            exact_id
        };

        insert(&mut map, target_id, dir, base, entry);
    }

    let mut groups: Vec<PairGroup> = map.into_values().collect();
    for group in &mut groups {
        group.raws.sort_by(|a, b| a.file_name.cmp(&b.file_name));
        group.others.sort_by(|a, b| a.file_name.cmp(&b.file_name));
        group.status = match (group.raws.is_empty(), group.others.is_empty()) {
            (false, false) => GroupStatus::Complete,
            (false, true) => GroupStatus::RawOnly,
            (true, false) => GroupStatus::NonRawOnly,
            (true, true) => unreachable!("group cannot be empty"),
        };
    }
    groups
}

/// Convenience wrapper used by the scan command.
pub fn scan(
    root: &Path,
    config: &AppConfig,
    on_progress: impl FnMut(usize),
) -> Result<ScanResult, AppError> {
    let collected = collect_files(root, config, on_progress)?;
    let groups = build_pair_groups(collected.entries, config.match_exported_suffixes);
    Ok(ScanResult {
        root: root.to_string_lossy().into_owned(),
        groups,
        total_files: collected.total_files,
        skipped_files: collected.skipped_files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};

    fn touch(dir: &Path, name: &str) {
        File::create(dir.join(name)).unwrap();
    }

    fn scan_dir(root: &Path) -> Vec<PairGroup> {
        let config = AppConfig::default();
        let collected = collect_files(root, &config, |_| {}).unwrap();
        build_pair_groups(collected.entries, config.match_exported_suffixes)
    }

    #[test]
    fn pairs_same_basename_case_insensitive() {
        let tmp = tempfile::tempdir().unwrap();
        touch(tmp.path(), "DSC001.ARW");
        touch(tmp.path(), "dsc001.JPG");

        let groups = scan_dir(tmp.path());
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].status, GroupStatus::Complete);
        assert_eq!(groups[0].raws.len(), 1);
        assert_eq!(groups[0].others.len(), 1);
    }

    #[test]
    fn one_raw_with_multiple_non_raw_is_one_group() {
        let tmp = tempfile::tempdir().unwrap();
        touch(tmp.path(), "IMG_0001.CR3");
        touch(tmp.path(), "IMG_0001.jpg");
        touch(tmp.path(), "IMG_0001.png");

        let groups = scan_dir(tmp.path());
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].raws.len(), 1);
        assert_eq!(groups[0].others.len(), 2);
        assert_eq!(groups[0].status, GroupStatus::Complete);
    }

    #[test]
    fn detects_orphans_in_both_directions() {
        let tmp = tempfile::tempdir().unwrap();
        touch(tmp.path(), "IMG_0002.CR2"); // RAW orphan
        touch(tmp.path(), "IMG_0003.jpg"); // non-RAW orphan

        let groups = scan_dir(tmp.path());
        assert_eq!(groups.len(), 2);
        let raw_only = groups.iter().find(|g| g.base_name == "IMG_0002").unwrap();
        let jpg_only = groups.iter().find(|g| g.base_name == "IMG_0003").unwrap();
        assert_eq!(raw_only.status, GroupStatus::RawOnly);
        assert_eq!(jpg_only.status, GroupStatus::NonRawOnly);
    }

    #[test]
    fn same_basename_in_different_dirs_does_not_pair() {
        let tmp = tempfile::tempdir().unwrap();
        let sub = tmp.path().join("sub");
        fs::create_dir(&sub).unwrap();
        touch(tmp.path(), "DSC001.ARW");
        touch(&sub, "DSC001.jpg");

        let groups = scan_dir(tmp.path());
        assert_eq!(groups.len(), 2);
        assert!(groups.iter().all(|g| g.status != GroupStatus::Complete));
    }

    #[test]
    fn unknown_extensions_are_skipped() {
        let tmp = tempfile::tempdir().unwrap();
        touch(tmp.path(), "notes.txt");
        touch(tmp.path(), "video.mp4");
        touch(tmp.path(), "IMG_0004.cr3");

        let config = AppConfig::default();
        let collected = collect_files(tmp.path(), &config, |_| {}).unwrap();
        assert_eq!(collected.entries.len(), 1);
        assert_eq!(collected.skipped_files, 2);
        assert_eq!(collected.total_files, 3);
    }

    #[test]
    fn hidden_directories_are_skipped() {
        let tmp = tempfile::tempdir().unwrap();
        let hidden = tmp.path().join(".cache");
        fs::create_dir(&hidden).unwrap();
        touch(&hidden, "IMG_9999.cr3");
        touch(tmp.path(), "IMG_0005.cr3");

        let groups = scan_dir(tmp.path());
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].base_name, "IMG_0005");
    }

    #[test]
    fn custom_extension_lists_take_effect() {
        let tmp = tempfile::tempdir().unwrap();
        touch(tmp.path(), "IMG_0006.xyz");
        touch(tmp.path(), "IMG_0006.jpg");

        let mut config = AppConfig::default();
        config.raw_extensions = vec!["xyz".into()];
        let collected = collect_files(tmp.path(), &config, |_| {}).unwrap();
        let groups = build_pair_groups(collected.entries, config.match_exported_suffixes);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].status, GroupStatus::Complete);
    }

    #[test]
    fn files_without_extension_are_skipped() {
        let tmp = tempfile::tempdir().unwrap();
        touch(tmp.path(), "README");
        let config = AppConfig::default();
        let collected = collect_files(tmp.path(), &config, |_| {}).unwrap();
        assert!(collected.entries.is_empty());
        assert_eq!(collected.skipped_files, 1);
    }

    #[test]
    fn exported_variants_join_the_raw_group() {
        let tmp = tempfile::tempdir().unwrap();
        touch(tmp.path(), "IMG_0001.CR3");
        touch(tmp.path(), "IMG_0001.JPG"); // camera JPG
        touch(tmp.path(), "IMG_0001-1.jpg"); // export 1
        touch(tmp.path(), "IMG_0001_edit.jpg"); // export 2
        touch(tmp.path(), "IMG_0001 (2).jpg"); // export 3

        let groups = scan_dir(tmp.path());
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].status, GroupStatus::Complete);
        assert_eq!(groups[0].raws.len(), 1);
        assert_eq!(groups[0].others.len(), 4);
    }

    #[test]
    fn numeric_continuation_is_not_an_export() {
        let tmp = tempfile::tempdir().unwrap();
        touch(tmp.path(), "IMG_0001.CR3");
        touch(tmp.path(), "IMG_00010.jpg"); // different photo, not an export

        let groups = scan_dir(tmp.path());
        assert_eq!(groups.len(), 2);
    }

    #[test]
    fn export_prefers_longest_matching_raw_basename() {
        let tmp = tempfile::tempdir().unwrap();
        touch(tmp.path(), "IMG_0001.CR3");
        touch(tmp.path(), "IMG_0001-1.CR3");
        touch(tmp.path(), "IMG_0001-1-edit.jpg"); // export of IMG_0001-1, not IMG_0001

        let groups = scan_dir(tmp.path());
        assert_eq!(groups.len(), 2);
        let longer = groups
            .iter()
            .find(|g| g.base_name.to_lowercase() == "img_0001-1")
            .unwrap();
        assert_eq!(longer.others.len(), 1);
        assert_eq!(longer.status, GroupStatus::Complete);
        let shorter = groups
            .iter()
            .find(|g| g.base_name.to_lowercase() == "img_0001")
            .unwrap();
        assert_eq!(shorter.status, GroupStatus::RawOnly);
    }

    #[test]
    fn suffix_matching_can_be_disabled() {
        let tmp = tempfile::tempdir().unwrap();
        touch(tmp.path(), "IMG_0001.CR3");
        touch(tmp.path(), "IMG_0001-1.jpg");

        let config = AppConfig::default();
        let collected = collect_files(tmp.path(), &config, |_| {}).unwrap();
        let groups = build_pair_groups(collected.entries, false);
        assert_eq!(groups.len(), 2);
    }

    #[test]
    fn export_without_its_raw_stays_orphan() {
        let tmp = tempfile::tempdir().unwrap();
        touch(tmp.path(), "IMG_0007-1.jpg"); // RAW was already deleted

        let groups = scan_dir(tmp.path());
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].status, GroupStatus::NonRawOnly);
    }
}
