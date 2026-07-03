mod commands;
mod config;
mod error;
mod model;
mod scanner;
mod state;

pub use error::AppError;

use tauri::Manager;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            let config_path = app
                .path()
                .app_config_dir()
                .expect("cannot resolve app config dir")
                .join("config.json");
            let cfg = config::load_or_default(&config_path);
            // First run: persist defaults so the user can find/edit the file.
            if !config_path.exists() {
                if let Err(e) = config::save(&config_path, &cfg) {
                    log::warn!("failed to write default config: {e}");
                }
            }
            app.manage(AppState::new(cfg, config_path));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan::scan_folder,
            commands::settings::get_config,
            commands::settings::set_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
