use tauri::State;

use crate::config::{self, AppConfig};
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn get_config(state: State<'_, AppState>) -> Result<AppConfig, AppError> {
    Ok(state.config.read().expect("config lock poisoned").clone())
}

#[tauri::command]
pub async fn set_config(
    state: State<'_, AppState>,
    mut config: AppConfig,
) -> Result<AppConfig, AppError> {
    config.validate()?;
    config::save(&state.config_path, &config)?;
    *state.config.write().expect("config lock poisoned") = config.clone();
    Ok(config)
}

/// Restores defaults but keeps the current UI language.
#[tauri::command]
pub async fn reset_config(state: State<'_, AppState>) -> Result<AppConfig, AppError> {
    let language = state
        .config
        .read()
        .expect("config lock poisoned")
        .language
        .clone();
    let mut config = AppConfig::default();
    config.language = language;
    config::save(&state.config_path, &config)?;
    *state.config.write().expect("config lock poisoned") = config.clone();
    Ok(config)
}
