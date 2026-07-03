use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::AppError;
use crate::model::FileKind;
use crate::preview;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ThumbReady {
    path: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ThumbError {
    path: String,
    message: String,
}

/// Generates and caches thumbnails/previews on a rayon worker pool.
/// Cache keys include mtime+size, so edits invalidate naturally.
pub struct ThumbService {
    app: AppHandle,
    thumb_dir: PathBuf,
    preview_dir: PathBuf,
    pending: Arc<Mutex<HashSet<String>>>,
    generation: Arc<AtomicU64>,
}

impl ThumbService {
    pub fn new(app: AppHandle, cache_root: PathBuf) -> Result<Self, AppError> {
        let thumb_dir = cache_root.join("thumbs");
        let preview_dir = cache_root.join("previews");
        fs::create_dir_all(&thumb_dir)?;
        fs::create_dir_all(&preview_dir)?;
        Ok(Self {
            app,
            thumb_dir,
            preview_dir,
            pending: Arc::new(Mutex::new(HashSet::new())),
            generation: Arc::new(AtomicU64::new(0)),
        })
    }

    /// Queues background thumbnail generation; emits `thumb://ready` /
    /// `thumb://error` as each completes. Cache hits emit immediately.
    pub fn request(&self, jobs: Vec<(PathBuf, FileKind)>) {
        let generation = self.generation.load(Ordering::SeqCst);
        for (path, kind) in jobs {
            let key = path.to_string_lossy().to_lowercase();
            {
                let mut pending = self.pending.lock().expect("pending lock poisoned");
                if !pending.insert(key.clone()) {
                    continue; // already queued
                }
            }
            let app = self.app.clone();
            let thumb_dir = self.thumb_dir.clone();
            let pending = Arc::clone(&self.pending);
            let gen_counter = Arc::clone(&self.generation);
            rayon::spawn(move || {
                // A newer generation means the user navigated away; drop the job.
                if gen_counter.load(Ordering::SeqCst) == generation {
                    let path_str = path.to_string_lossy().into_owned();
                    match ensure_cached(&thumb_dir, &path, kind, CacheKind::Thumb) {
                        Ok(_) => {
                            let _ = app.emit("thumb://ready", ThumbReady { path: path_str });
                        }
                        Err(e) => {
                            let _ = app.emit(
                                "thumb://error",
                                ThumbError {
                                    path: path_str,
                                    message: e.to_string(),
                                },
                            );
                        }
                    }
                }
                pending.lock().expect("pending lock poisoned").remove(&key);
            });
        }
    }

    /// Invalidates all queued-but-not-started jobs.
    pub fn clear_queue(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
    }

    /// Synchronous fetch used by the `omniraw://` protocol handler
    /// (which already runs off the main thread).
    pub fn get_thumbnail(&self, path: &Path, kind: FileKind) -> Result<Vec<u8>, AppError> {
        let cached = ensure_cached(&self.thumb_dir, path, kind, CacheKind::Thumb)?;
        Ok(fs::read(cached)?)
    }

    pub fn get_preview(&self, path: &Path, kind: FileKind) -> Result<Vec<u8>, AppError> {
        let cached = ensure_cached(&self.preview_dir, path, kind, CacheKind::Preview)?;
        Ok(fs::read(cached)?)
    }
}

#[derive(Clone, Copy)]
enum CacheKind {
    Thumb,
    Preview,
}

/// Cache key: blake3 over lowercased path + mtime + size.
fn cache_file_name(path: &Path) -> Result<String, AppError> {
    let meta = fs::metadata(path)?;
    let mtime_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    let seed = format!(
        "{}|{}|{}",
        path.to_string_lossy().to_lowercase(),
        mtime_ms,
        meta.len()
    );
    let hash = blake3::hash(seed.as_bytes()).to_hex();
    Ok(format!("{}.jpg", &hash.as_str()[..32]))
}

fn ensure_cached(
    dir: &Path,
    path: &Path,
    kind: FileKind,
    cache_kind: CacheKind,
) -> Result<PathBuf, AppError> {
    let target = dir.join(cache_file_name(path)?);
    if target.exists() {
        return Ok(target);
    }
    let bytes = match cache_kind {
        CacheKind::Thumb => preview::generate_thumbnail(path, kind)?,
        CacheKind::Preview => preview::generate_preview(path, kind)?,
    };
    // Write via unique temp file; a concurrent generator winning the rename
    // race is fine — content is identical.
    let tmp = dir.join(format!(
        "{}.tmp-{}",
        target.file_name().unwrap().to_string_lossy(),
        std::process::id()
    ));
    fs::write(&tmp, &bytes)?;
    if fs::rename(&tmp, &target).is_err() {
        let _ = fs::remove_file(&tmp);
        if !target.exists() {
            return Err(AppError::Other("thumbnail cache write failed".into()));
        }
    }
    Ok(target)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;

    #[test]
    fn cache_key_changes_with_content_size() {
        let tmp = tempfile::tempdir().unwrap();
        let file = tmp.path().join("a.jpg");
        File::create(&file).unwrap().write_all(b"12345").unwrap();
        let k1 = cache_file_name(&file).unwrap();
        File::create(&file).unwrap().write_all(b"123456789").unwrap();
        let k2 = cache_file_name(&file).unwrap();
        assert_ne!(k1, k2);
    }

    #[test]
    fn cache_key_differs_per_path() {
        let tmp = tempfile::tempdir().unwrap();
        let a = tmp.path().join("a.jpg");
        let b = tmp.path().join("b.jpg");
        File::create(&a).unwrap().write_all(b"same").unwrap();
        File::create(&b).unwrap().write_all(b"same").unwrap();
        assert_ne!(cache_file_name(&a).unwrap(), cache_file_name(&b).unwrap());
    }

    #[test]
    fn ensure_cached_writes_and_reuses_file() {
        let tmp = tempfile::tempdir().unwrap();
        let cache = tmp.path().join("cache");
        fs::create_dir_all(&cache).unwrap();
        let src = tmp.path().join("img.png");
        image::RgbaImage::new(64, 64)
            .save_with_format(&src, image::ImageFormat::Png)
            .unwrap();

        let first = ensure_cached(&cache, &src, FileKind::NonRaw, CacheKind::Thumb).unwrap();
        assert!(first.exists());
        let mtime1 = fs::metadata(&first).unwrap().modified().unwrap();
        let second = ensure_cached(&cache, &src, FileKind::NonRaw, CacheKind::Thumb).unwrap();
        assert_eq!(first, second);
        assert_eq!(mtime1, fs::metadata(&second).unwrap().modified().unwrap());
    }
}
