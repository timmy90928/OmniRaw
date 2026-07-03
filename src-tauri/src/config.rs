use std::collections::HashSet;
use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::model::DeleteMode;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub raw_extensions: Vec<String>,
    pub non_raw_extensions: Vec<String>,
    pub default_delete_mode: DeleteMode,
    pub language: String,
    /// Pair exported variants like `IMG_0001-1.jpg` / `IMG_0001_edit.jpg`
    /// into the `IMG_0001.CR3` group (longest-prefix match on RAW basenames).
    #[serde(default = "default_true")]
    pub match_exported_suffixes: bool,
}

fn default_true() -> bool {
    true
}

impl Default for AppConfig {
    fn default() -> Self {
        let to_vec = |exts: &[&str]| exts.iter().map(|s| s.to_string()).collect();
        Self {
            raw_extensions: to_vec(&[
                "dng", "cr2", "cr3", "nef", "nrw", "arw", "orf", "raf", "rw2", "pef", "srw",
                "x3f", "3fr", "iiq",
            ]),
            non_raw_extensions: to_vec(&[
                "jpg", "jpeg", "png", "heic", "heif", "tif", "tiff", "webp",
            ]),
            default_delete_mode: DeleteMode::Pair,
            language: "zh-TW".to_string(),
            match_exported_suffixes: true,
        }
    }
}

impl AppConfig {
    /// Normalizes and validates extension lists: lowercase, no dots, no
    /// duplicates, and the two lists must not overlap.
    pub fn validate(&mut self) -> Result<(), AppError> {
        for list in [&mut self.raw_extensions, &mut self.non_raw_extensions] {
            let mut seen = HashSet::new();
            let mut cleaned = Vec::new();
            for ext in list.iter() {
                let e = ext.trim().trim_start_matches('.').to_lowercase();
                if e.is_empty() {
                    continue;
                }
                if !e.chars().all(|c| c.is_ascii_alphanumeric()) {
                    return Err(AppError::InvalidConfig(format!(
                        "invalid extension: {ext}"
                    )));
                }
                if seen.insert(e.clone()) {
                    cleaned.push(e);
                }
            }
            if cleaned.is_empty() {
                return Err(AppError::InvalidConfig(
                    "extension list must not be empty".into(),
                ));
            }
            *list = cleaned;
        }
        let raw: HashSet<_> = self.raw_extensions.iter().collect();
        if let Some(dup) = self.non_raw_extensions.iter().find(|e| raw.contains(e)) {
            return Err(AppError::InvalidConfig(format!(
                "extension appears in both lists: {dup}"
            )));
        }
        Ok(())
    }
}

pub fn load_or_default(config_path: &Path) -> AppConfig {
    match fs::read_to_string(config_path) {
        Ok(text) => match serde_json::from_str::<AppConfig>(&text) {
            Ok(mut cfg) => {
                if cfg.validate().is_ok() {
                    return cfg;
                }
                log::warn!("config file invalid, falling back to defaults");
                AppConfig::default()
            }
            Err(e) => {
                log::warn!("config file unparsable ({e}), falling back to defaults");
                AppConfig::default()
            }
        },
        Err(_) => AppConfig::default(),
    }
}

pub fn save(config_path: &Path, config: &AppConfig) -> Result<(), AppError> {
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let text = serde_json::to_string_pretty(config).map_err(|e| AppError::Other(e.to_string()))?;
    fs::write(config_path, text)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_is_valid() {
        let mut cfg = AppConfig::default();
        assert!(cfg.validate().is_ok());
    }

    #[test]
    fn validate_normalizes_case_dots_and_duplicates() {
        let mut cfg = AppConfig::default();
        cfg.raw_extensions = vec![".CR3".into(), "cr3".into(), " Nef ".into()];
        cfg.validate().unwrap();
        assert_eq!(cfg.raw_extensions, vec!["cr3", "nef"]);
    }

    #[test]
    fn validate_rejects_overlapping_lists() {
        let mut cfg = AppConfig::default();
        cfg.non_raw_extensions.push("cr2".into());
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn validate_rejects_empty_list() {
        let mut cfg = AppConfig::default();
        cfg.raw_extensions = vec!["  ".into()];
        assert!(cfg.validate().is_err());
    }
}
