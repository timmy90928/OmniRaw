use std::path::{Path, PathBuf};
use std::sync::RwLock;

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
    thumbs: ThumbService,
}

impl AppState {
    pub fn new(config: AppConfig, config_path: PathBuf, thumbs: ThumbService) -> Self {
        Self {
            config: RwLock::new(config),
            config_path,
            scan_root: RwLock::new(None),
            groups: RwLock::new(Vec::new()),
            thumbs,
        }
    }

    pub fn thumbs(&self) -> &ThumbService {
        &self.thumbs
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
