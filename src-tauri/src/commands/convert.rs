use std::path::{Path, PathBuf};

use tauri::State;

use crate::error::AppError;
use crate::model::FileKind;
use crate::preview;
use crate::state::AppState;

/// Converts a RAW file to a JPG saved next to it (same basename), so the group
/// stops being RAW-only. Uses the RAW's embedded preview. Returns the created path.
#[tauri::command]
pub async fn convert_raw_to_jpg(
    state: State<'_, AppState>,
    path: String,
) -> Result<String, AppError> {
    let path = state.ensure_in_scan_root(Path::new(&path))?;
    if state.file_kind(&path) != FileKind::Raw {
        return Err(AppError::Other("not a RAW file".into()));
    }
    let dir = path
        .parent()
        .ok_or_else(|| AppError::Other("RAW has no parent directory".into()))?
        .to_path_buf();
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| AppError::Other("RAW has no file name".into()))?
        .to_string();

    let output = tauri::async_runtime::spawn_blocking(move || -> Result<PathBuf, AppError> {
        let bytes = preview::export_embedded_jpeg(&path)?;
        // Never overwrite an existing file — pick a non-colliding name instead.
        let out = unique_output_path(&dir, &stem, |p| p.exists());
        std::fs::write(&out, &bytes)?;
        Ok(out)
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))??;

    Ok(output.to_string_lossy().into_owned())
}

/// `<stem>.jpg` if free, otherwise `<stem>_converted-1.jpg`, `-2`, … The
/// existence check is injected so the naming logic is unit-testable.
fn unique_output_path(dir: &Path, stem: &str, exists: impl Fn(&Path) -> bool) -> PathBuf {
    let primary = dir.join(format!("{stem}.jpg"));
    if !exists(&primary) {
        return primary;
    }
    let mut n = 1;
    loop {
        let candidate = dir.join(format!("{stem}_converted-{n}.jpg"));
        if !exists(&candidate) {
            return candidate;
        }
        n += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn uses_plain_name_when_free() {
        let dir = Path::new("/photos");
        let out = unique_output_path(dir, "IMG_0001", |_| false);
        assert_eq!(out, dir.join("IMG_0001.jpg"));
    }

    #[test]
    fn avoids_existing_jpg() {
        let dir = Path::new("/photos");
        let taken: HashSet<PathBuf> = [dir.join("IMG_0001.jpg")].into_iter().collect();
        let out = unique_output_path(dir, "IMG_0001", |p| taken.contains(p));
        assert_eq!(out, dir.join("IMG_0001_converted-1.jpg"));
    }

    #[test]
    fn increments_until_free() {
        let dir = Path::new("/photos");
        let taken: HashSet<PathBuf> = [
            dir.join("IMG_0001.jpg"),
            dir.join("IMG_0001_converted-1.jpg"),
            dir.join("IMG_0001_converted-2.jpg"),
        ]
        .into_iter()
        .collect();
        let out = unique_output_path(dir, "IMG_0001", |p| taken.contains(p));
        assert_eq!(out, dir.join("IMG_0001_converted-3.jpg"));
    }
}
