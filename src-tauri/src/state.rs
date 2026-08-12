use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, RwLock};

use crate::config::AppConfig;
use crate::error::AppError;
use crate::model::{FileKind, PairGroup};
use crate::thumbs::ThumbService;

pub struct AppState {
    pub config: RwLock<AppConfig>,
    pub config_path: PathBuf,
    pub scan_root: RwLock<Option<PathBuf>>,
    /// Last scan result — deletion commands resolve group ids against this.
    pub groups: RwLock<Vec<PairGroup>>,
    pub scan_counts: RwLock<(usize, usize)>,
    pub deletion_log_path: PathBuf,
    pub deletion_manifest_path: PathBuf,
    pub watcher: Mutex<Option<notify::RecommendedWatcher>>,
    pub scan_generation: std::sync::Arc<AtomicU64>,
    pub similarity_generation: std::sync::Arc<AtomicU64>,
    similarity_lifecycle: Mutex<()>,
    similarity_hashes: Mutex<HashMap<String, u64>>,
    similarity_cache_path: PathBuf,
    thumbs: ThumbService,
}

impl AppState {
    pub fn new(
        config: AppConfig,
        config_path: PathBuf,
        data_dir: PathBuf,
        thumbs: ThumbService,
    ) -> Self {
        let similarity_cache_path = data_dir.join("similarity-hashes.json");
        let similarity_hashes = std::fs::read_to_string(&similarity_cache_path)
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default();
        thumbs.set_cache_limit(config.cache_limit_mb * 1024 * 1024);
        Self {
            config: RwLock::new(config),
            config_path,
            scan_root: RwLock::new(None),
            groups: RwLock::new(Vec::new()),
            scan_counts: RwLock::new((0, 0)),
            deletion_log_path: data_dir.join("deletion-operations.jsonl"),
            deletion_manifest_path: data_dir.join("deletion-manifest.json"),
            watcher: Mutex::new(None),
            scan_generation: std::sync::Arc::new(AtomicU64::new(0)),
            similarity_generation: std::sync::Arc::new(AtomicU64::new(0)),
            similarity_lifecycle: Mutex::new(()),
            similarity_hashes: Mutex::new(similarity_hashes),
            similarity_cache_path,
            thumbs,
        }
    }

    pub fn thumbs(&self) -> &ThumbService {
        &self.thumbs
    }

    pub fn next_scan_generation(&self) -> u64 {
        self.scan_generation.fetch_add(1, Ordering::SeqCst) + 1
    }

    pub fn next_similarity_generation(&self) -> u64 {
        self.similarity_generation.fetch_add(1, Ordering::SeqCst) + 1
    }

    pub fn similarity_cache_path(&self) -> &Path {
        &self.similarity_cache_path
    }

    pub fn begin_similarity_job(&self) -> (u64, HashMap<String, u64>) {
        let _lifecycle = self
            .similarity_lifecycle
            .lock()
            .expect("similarity lifecycle lock poisoned");
        let job_id = self.next_similarity_generation();
        let hashes = self
            .similarity_hashes
            .lock()
            .expect("similarity cache lock poisoned")
            .clone();
        (job_id, hashes)
    }

    pub fn commit_similarity_hashes(
        &self,
        job_id: u64,
        hashes: HashMap<String, u64>,
    ) -> Result<bool, AppError> {
        let _lifecycle = self
            .similarity_lifecycle
            .lock()
            .expect("similarity lifecycle lock poisoned");
        if self.similarity_generation.load(Ordering::SeqCst) != job_id {
            return Ok(false);
        }
        *self
            .similarity_hashes
            .lock()
            .expect("similarity cache lock poisoned") = hashes;
        self.flush_similarity_hashes()?;
        Ok(true)
    }

    pub fn clear_similarity_hashes(&self) -> Result<(), AppError> {
        let _lifecycle = self
            .similarity_lifecycle
            .lock()
            .expect("similarity lifecycle lock poisoned");
        self.next_similarity_generation();
        self.similarity_hashes
            .lock()
            .expect("similarity cache lock poisoned")
            .clear();
        for path in [
            self.similarity_cache_path.clone(),
            self.similarity_cache_path.with_extension("json.tmp"),
        ] {
            match std::fs::remove_file(path) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return Err(error.into()),
            }
        }
        Ok(())
    }

    pub fn flush_similarity_hashes(&self) -> Result<(), AppError> {
        let hashes = self
            .similarity_hashes
            .lock()
            .expect("similarity cache lock poisoned");
        if let Some(parent) = self.similarity_cache_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let bytes = serde_json::to_vec(&*hashes).map_err(|e| AppError::Other(e.to_string()))?;
        let temp = self.similarity_cache_path.with_extension("json.tmp");
        std::fs::write(&temp, bytes)?;
        if self.similarity_cache_path.exists() {
            std::fs::remove_file(&self.similarity_cache_path)?;
        }
        std::fs::rename(temp, &self.similarity_cache_path)?;
        Ok(())
    }

    /// Classifies a path by extension against the current config.
    pub fn file_kind(&self, path: &Path) -> FileKind {
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();
        let config = self.config.read().expect("config lock poisoned");
        if config.raw_extensions.iter().any(|e| e == &ext) {
            FileKind::Raw
        } else {
            FileKind::NonRaw
        }
    }

    /// Canonicalizes `path` and verifies it lives under the current scan root.
    /// Compensates for bypassing Tauri's fs scope — every command that accepts
    /// a path from the frontend must go through this.
    pub fn ensure_in_scan_root(&self, path: &Path) -> Result<PathBuf, AppError> {
        let root = self
            .scan_root
            .read()
            .expect("scan_root lock poisoned")
            .clone()
            .ok_or_else(|| AppError::PathOutOfScope("no folder opened".into()))?;
        let canonical = dunce::canonicalize(path)
            .map_err(|_| AppError::PathOutOfScope(path.display().to_string()))?;
        if canonical.starts_with(&root) {
            Ok(canonical)
        } else {
            Err(AppError::PathOutOfScope(path.display().to_string()))
        }
    }
}
