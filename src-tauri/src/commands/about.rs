use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, State};

use crate::error::AppError;
use crate::model::StorageLocations;
use crate::state::AppState;

fn display(path: impl AsRef<Path>) -> String {
    path.as_ref().to_string_lossy().into_owned()
}

fn resolve(value: Result<PathBuf, tauri::Error>, name: &str) -> Result<PathBuf, AppError> {
    value.map_err(|error| AppError::Other(format!("cannot resolve {name}: {error}")))
}

#[tauri::command]
pub async fn get_storage_locations(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<StorageLocations, AppError> {
    let paths = app.path();
    let app_data_dir = resolve(paths.app_data_dir(), "app data directory")?;
    let app_local_data_dir = resolve(paths.app_local_data_dir(), "local app data directory")?;
    let app_cache_dir = resolve(paths.app_cache_dir(), "app cache directory")?;
    let app_log_dir = resolve(paths.app_log_dir(), "app log directory")?;
    let webview_profile_dir = if cfg!(target_os = "windows") {
        app_local_data_dir.join("EBWebView")
    } else {
        app_local_data_dir.clone()
    };
    let session_storage_dir = if cfg!(target_os = "windows") {
        webview_profile_dir
            .join("Default")
            .join("Local Storage")
            .join("leveldb")
    } else {
        webview_profile_dir.clone()
    };
    let active_scan_root = state
        .scan_root
        .read()
        .expect("scan root lock poisoned")
        .as_ref()
        .map(display);

    Ok(StorageLocations {
        executable_file: display(std::env::current_exe()?),
        config_file: display(&state.config_path),
        app_data_dir: display(app_data_dir),
        app_local_data_dir: display(app_local_data_dir),
        app_cache_dir: display(app_cache_dir),
        app_log_dir: display(app_log_dir),
        webview_profile_dir: display(webview_profile_dir),
        session_storage_dir: display(session_storage_dir),
        session_storage_keys: vec![
            "omniraw.library-session.v1".into(),
            "omniraw.cull-session.v1".into(),
        ],
        thumbnail_cache_dir: display(state.thumbs().thumbnail_dir()),
        preview_cache_dir: display(state.thumbs().preview_dir()),
        similarity_cache_file: display(state.similarity_cache_path()),
        deletion_log_file: display(&state.deletion_log_path),
        deletion_manifest_file: display(&state.deletion_manifest_path),
        updater_temp_dir: display(std::env::temp_dir()),
        active_scan_root,
    })
}
