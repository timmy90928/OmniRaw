use std::path::{Path, PathBuf};
use std::sync::RwLock;

use crate::config::AppConfig;
use crate::error::AppError;

pub struct AppState {
    pub config: RwLock<AppConfig>,
    pub config_path: PathBuf,
    pub scan_root: RwLock<Option<PathBuf>>,
}

impl AppState {
    pub fn new(config: AppConfig, config_path: PathBuf) -> Self {
        Self {
            config: RwLock::new(config),
            config_path,
            scan_root: RwLock::new(None),
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
        let canonical = path
            .canonicalize()
            .map_err(|_| AppError::PathOutOfScope(path.display().to_string()))?;
        if canonical.starts_with(&root) {
            Ok(canonical)
        } else {
            Err(AppError::PathOutOfScope(path.display().to_string()))
        }
    }
}
