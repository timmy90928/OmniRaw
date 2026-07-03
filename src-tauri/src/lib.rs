mod commands;
mod config;
mod error;
mod exif;
mod model;
mod preview;
mod protocol;
mod scanner;
mod state;
mod thumbs;

pub use error::AppError;

use tauri::Manager;

use state::AppState;
use thumbs::ThumbService;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .register_asynchronous_uri_scheme_protocol("omniraw", protocol::handle)
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

            let cache_root = app
                .path()
                .app_cache_dir()
                .expect("cannot resolve app cache dir");
            let thumbs = ThumbService::new(app.handle().clone(), cache_root)?;

            app.manage(AppState::new(cfg, config_path, thumbs));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan::scan_folder,
            commands::settings::get_config,
            commands::settings::set_config,
            commands::media::request_thumbnails,
            commands::media::clear_thumbnail_queue,
            commands::media::get_metadata,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
