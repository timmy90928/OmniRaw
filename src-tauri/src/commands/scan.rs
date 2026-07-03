use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::error::AppError;
use crate::model::ScanResult;
use crate::scanner;
use crate::state::AppState;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanProgress {
    scanned_files: usize,
}

#[tauri::command]
pub async fn scan_folder(
    app: AppHandle,
    state: State<'_, AppState>,
    root: String,
) -> Result<ScanResult, AppError> {
    let root_path = dunce::canonicalize(PathBuf::from(&root))
        .map_err(|_| AppError::Other(format!("cannot open folder: {root}")))?;

    let config = state
        .config
        .read()
        .expect("config lock poisoned")
        .clone();

    // Store the root first so later per-path commands can validate against it.
    *state.scan_root.write().expect("scan_root lock poisoned") = Some(root_path.clone());

    let result = tauri::async_runtime::spawn_blocking(move || {
        scanner::scan(&root_path, &config, |scanned_files| {
            let _ = app.emit("scan://progress", ScanProgress { scanned_files });
        })
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))??;

    *state.groups.write().expect("groups lock poisoned") = result.groups.clone();

    Ok(result)
}
