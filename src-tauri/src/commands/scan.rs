use std::collections::BTreeMap;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::error::AppError;
use crate::model::{FileEntry, ScanResult};
use crate::scanner;
use crate::state::AppState;
use crate::watcher;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanProgress {
    scanned_files: usize,
}

fn is_safe_missing_path(path: &Path, root: &Path) -> bool {
    path.is_absolute()
        && path.starts_with(root)
        && !path
            .components()
            .any(|component| matches!(component, Component::ParentDir))
}

fn previous_entries(state: &AppState) -> Vec<FileEntry> {
    state
        .groups
        .read()
        .expect("groups lock poisoned")
        .iter()
        .flat_map(|group| group.raws.iter().chain(&group.others).cloned())
        .collect()
}

fn commit_result(state: &AppState, result: &ScanResult) {
    *state.groups.write().expect("groups lock poisoned") = result.groups.clone();
    *state
        .scan_counts
        .write()
        .expect("scan counts lock poisoned") = (result.total_files, result.skipped_files);
}

#[tauri::command]
pub async fn scan_folder(
    app: AppHandle,
    state: State<'_, AppState>,
    root: String,
) -> Result<ScanResult, AppError> {
    let root_path = dunce::canonicalize(PathBuf::from(&root))
        .map_err(|_| AppError::Other(format!("cannot open folder: {root}")))?;
    let config = state.config.read().expect("config lock poisoned").clone();
    let job_id = state.next_scan_generation();
    let generation = Arc::clone(&state.scan_generation);

    *state.scan_root.write().expect("scan_root lock poisoned") = Some(root_path.clone());
    let progress_app = app.clone();
    let scan_root = root_path.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        scanner::scan(&scan_root, &config, |scanned_files| {
            let _ = progress_app.emit("scan://progress", ScanProgress { scanned_files });
        })
    })
    .await
    .map_err(|error| AppError::Other(error.to_string()))??;

    if generation.load(Ordering::SeqCst) != job_id {
        return Err(AppError::Other("scan superseded by a newer request".into()));
    }
    commit_result(&state, &result);
    if let Err(error) = watcher::replace_watcher(&state, app, &root_path) {
        log::warn!("automatic folder monitoring unavailable: {error}");
    }
    Ok(result)
}

#[tauri::command]
pub async fn refresh_changed_paths(
    app: AppHandle,
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> Result<ScanResult, AppError> {
    let root = state
        .scan_root
        .read()
        .expect("scan_root lock poisoned")
        .clone()
        .ok_or_else(|| AppError::PathOutOfScope("no folder opened".into()))?;
    if paths.len() > 128 {
        return scan_folder(app, state, root.to_string_lossy().into_owned()).await;
    }

    let mut changed = Vec::new();
    for raw in paths {
        let path = PathBuf::from(&raw);
        let validated = if path.exists() {
            let canonical =
                dunce::canonicalize(&path).map_err(|_| AppError::PathOutOfScope(raw.clone()))?;
            if !canonical.starts_with(&root) {
                return Err(AppError::PathOutOfScope(raw));
            }
            canonical
        } else if is_safe_missing_path(&path, &root) {
            path
        } else {
            return Err(AppError::PathOutOfScope(raw));
        };
        if !changed.contains(&validated) {
            changed.push(validated);
        }
    }

    let config = state.config.read().expect("config lock poisoned").clone();
    let old_counts = *state.scan_counts.read().expect("scan counts lock poisoned");
    let entries = previous_entries(&state);
    let job_id = state.next_scan_generation();
    let generation = Arc::clone(&state.scan_generation);
    let progress_app = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut entries_by_path: BTreeMap<String, FileEntry> = entries
            .into_iter()
            .map(|entry| (entry.path.clone(), entry))
            .collect();
        let before = entries_by_path.len();
        for (index, path) in changed.iter().enumerate() {
            if generation.load(Ordering::SeqCst) != job_id {
                return Err(AppError::Other("scan superseded by a newer request".into()));
            }
            entries_by_path.retain(|existing, _| {
                let existing = Path::new(existing);
                existing != path && !existing.starts_with(path)
            });
            if path.is_file() {
                if let Some(entry) = scanner::file_entry(path, &config)? {
                    entries_by_path.insert(entry.path.clone(), entry);
                }
            } else if path.is_dir() {
                let collected = scanner::collect_files(path, &config, |_| {})?;
                for entry in collected.entries {
                    entries_by_path.insert(entry.path.clone(), entry);
                }
            }
            let _ = progress_app.emit(
                "scan://progress",
                ScanProgress {
                    scanned_files: index + 1,
                },
            );
        }
        let entries: Vec<FileEntry> = entries_by_path.into_values().collect();
        let supported_delta = entries.len() as isize - before as isize;
        let total_files = old_counts.0.saturating_add_signed(supported_delta);
        let groups = scanner::build_pair_groups_with_options(
            entries,
            config.match_exported_suffixes,
            config.match_sibling_folders,
            &config.sibling_folder_names,
        );
        Ok(ScanResult {
            root: root.to_string_lossy().into_owned(),
            groups,
            total_files,
            skipped_files: old_counts.1,
        })
    })
    .await
    .map_err(|error| AppError::Other(error.to_string()))??;

    if state.scan_generation.load(Ordering::SeqCst) != job_id {
        return Err(AppError::Other("scan superseded by a newer request".into()));
    }
    commit_result(&state, &result);
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_path_rejects_parent_traversal() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("photos");
        let traversing = root.join("..").join("secret.jpg");
        assert!(!is_safe_missing_path(&traversing, &root));
    }
}
