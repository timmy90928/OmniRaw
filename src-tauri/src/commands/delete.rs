use std::path::{Component, Path, PathBuf, Prefix};

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::error::AppError;
use crate::model::{DeleteMode, DeletionReport, DeletionRequest, FailedItem, PairGroup};
use crate::state::AppState;

const BATCH_SIZE: usize = 50;

/// Windows network (UNC) shares have no Recycle Bin. Passing such a path to
/// `trash` either fails cryptically (the shell can't resolve the `\\?\UNC\`
/// form) or permanently deletes the file — both unacceptable for a
/// recycle-bin-only tool. Detect these so we can refuse them cleanly.
fn is_network_path(path: &Path) -> bool {
    matches!(
        path.components().next(),
        Some(Component::Prefix(p)) if matches!(p.kind(), Prefix::UNC(..) | Prefix::VerbatimUNC(..))
    )
}

/// Marker prefix on `FailedItem.error` so the frontend can show a translated
/// "network share not supported" hint instead of the raw string.
pub const NETWORK_UNSUPPORTED: &str =
    "network-unsupported: network shares have no Recycle Bin; copy the files to a local drive to delete them";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DeleteProgress {
    done: usize,
    total: usize,
}

/// Pure mode→paths expansion (unit-tested; no filesystem access).
pub fn expand_request(group: &PairGroup, mode: DeleteMode) -> Vec<String> {
    let raws = group.raws.iter().map(|f| f.path.clone());
    let others = group.others.iter().map(|f| f.path.clone());
    match mode {
        DeleteMode::Pair => raws.chain(others).collect(),
        DeleteMode::RawOnly => raws.collect(),
        DeleteMode::NonRawOnly => others.collect(),
    }
}

#[tauri::command]
pub async fn commit_deletions(
    app: AppHandle,
    state: State<'_, AppState>,
    requests: Vec<DeletionRequest>,
) -> Result<DeletionReport, AppError> {
    let paths: Vec<String> = {
        let groups = state.groups.read().expect("groups lock poisoned");
        requests
            .iter()
            .filter_map(|req| {
                let group = groups.iter().find(|g| g.id == req.group_id);
                if group.is_none() {
                    log::warn!("unknown group id in deletion request: {}", req.group_id);
                }
                group.map(|g| expand_request(g, req.mode))
            })
            .flatten()
            .collect()
    };
    trash_paths(&app, &state, paths).await
}

#[tauri::command]
pub async fn delete_files(
    app: AppHandle,
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> Result<DeletionReport, AppError> {
    trash_paths(&app, &state, paths).await
}

async fn trash_paths(
    app: &AppHandle,
    state: &State<'_, AppState>,
    paths: Vec<String>,
) -> Result<DeletionReport, AppError> {
    let mut report = DeletionReport::default();
    let mut validated: Vec<PathBuf> = Vec::with_capacity(paths.len());
    for raw in paths {
        match state.ensure_in_scan_root(Path::new(&raw)) {
            // Refuse network paths up front — never risk a permanent delete.
            Ok(p) if is_network_path(&p) => report.failed.push(FailedItem {
                path: p.to_string_lossy().into_owned(),
                error: NETWORK_UNSUPPORTED.to_string(),
            }),
            Ok(p) => validated.push(p),
            Err(e) => report.failed.push(FailedItem {
                path: raw,
                error: e.to_string(),
            }),
        }
    }

    let total = validated.len();
    let app = app.clone();
    let mut batch_report = tauri::async_runtime::spawn_blocking(move || {
        let mut report = DeletionReport::default();
        let mut done = 0usize;
        for chunk in validated.chunks(BATCH_SIZE) {
            match trash::delete_all(chunk) {
                Ok(()) => {
                    report
                        .trashed
                        .extend(chunk.iter().map(|p| p.to_string_lossy().into_owned()));
                }
                Err(_) => {
                    // Batch failed — retry one by one for per-file errors.
                    for path in chunk {
                        match trash::delete(path) {
                            Ok(()) => report.trashed.push(path.to_string_lossy().into_owned()),
                            Err(e) => report.failed.push(FailedItem {
                                path: path.to_string_lossy().into_owned(),
                                error: e.to_string(),
                            }),
                        }
                    }
                }
            }
            done += chunk.len();
            let _ = app.emit("delete://progress", DeleteProgress { done, total });
        }
        report
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?;

    report.trashed.append(&mut batch_report.trashed);
    report.failed.append(&mut batch_report.failed);
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{FileEntry, FileKind, GroupStatus};

    fn entry(path: &str, kind: FileKind) -> FileEntry {
        FileEntry {
            path: path.into(),
            file_name: path.rsplit('/').next().unwrap().into(),
            ext: path.rsplit('.').next().unwrap().to_lowercase(),
            kind,
            size: 0,
            mtime_ms: 0,
        }
    }

    fn group() -> PairGroup {
        PairGroup {
            id: "d|img_0001".into(),
            dir: "d".into(),
            base_name: "IMG_0001".into(),
            raws: vec![entry("d/IMG_0001.CR3", FileKind::Raw)],
            others: vec![
                entry("d/IMG_0001.JPG", FileKind::NonRaw),
                entry("d/IMG_0001_edit.jpg", FileKind::NonRaw),
            ],
            status: GroupStatus::Complete,
        }
    }

    #[test]
    fn pair_mode_expands_to_all_files() {
        let paths = expand_request(&group(), DeleteMode::Pair);
        assert_eq!(paths.len(), 3);
    }

    #[test]
    fn non_raw_only_keeps_raw() {
        let paths = expand_request(&group(), DeleteMode::NonRawOnly);
        assert_eq!(paths, vec!["d/IMG_0001.JPG", "d/IMG_0001_edit.jpg"]);
    }

    #[test]
    fn raw_only_keeps_non_raw() {
        let paths = expand_request(&group(), DeleteMode::RawOnly);
        assert_eq!(paths, vec!["d/IMG_0001.CR3"]);
    }

    #[test]
    fn empty_side_expands_to_nothing() {
        let mut g = group();
        g.others.clear();
        assert!(expand_request(&g, DeleteMode::NonRawOnly).is_empty());
    }

    // UNC prefixes only parse into Prefix::(Verbatim)UNC on Windows targets.
    #[cfg(windows)]
    #[test]
    fn detects_unc_network_paths() {
        assert!(is_network_path(Path::new(r"\\?\UNC\140.0.0.1\temp\a.jpg")));
        assert!(is_network_path(Path::new(r"\\server\share\a.jpg")));
        assert!(!is_network_path(Path::new(r"\\?\C:\photos\a.jpg")));
        assert!(!is_network_path(Path::new(r"C:\photos\a.jpg")));
    }
}
