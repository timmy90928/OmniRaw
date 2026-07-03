use std::path::PathBuf;

use tauri::State;

use crate::error::AppError;
use crate::exif;
use crate::model::ExifData;
use crate::state::AppState;

#[tauri::command]
pub async fn get_metadata(
    state: State<'_, AppState>,
    path: String,
) -> Result<ExifData, AppError> {
    let path = state.ensure_in_scan_root(PathBuf::from(&path).as_path())?;
    let kind = state.file_kind(&path);
    let data =
        tauri::async_runtime::spawn_blocking(move || exif::read_exif(&path, kind))
            .await
            .map_err(|e| AppError::Other(e.to_string()))?;
    Ok(data)
}

#[tauri::command]
pub async fn request_thumbnails(
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> Result<(), AppError> {
    let mut jobs = Vec::with_capacity(paths.len());
    for raw in paths {
        match state.ensure_in_scan_root(PathBuf::from(&raw).as_path()) {
            Ok(path) => {
                let kind = state.file_kind(&path);
                jobs.push((path, kind));
            }
            Err(e) => log::warn!("thumbnail request rejected: {e}"),
        }
    }
    state.thumbs().request(jobs);
    Ok(())
}

#[tauri::command]
pub async fn clear_thumbnail_queue(state: State<'_, AppState>) -> Result<(), AppError> {
    state.thumbs().clear_queue();
    Ok(())
}
