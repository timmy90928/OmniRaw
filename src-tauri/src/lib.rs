mod audit;
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
mod watcher;

pub use error::AppError;

use tauri::Manager;

use state::AppState;
use thumbs::ThumbService;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        );

    // Auto-updater and process-relaunch are desktop-only.
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    builder
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

            let data_dir = app
                .path()
                .app_data_dir()
                .expect("cannot resolve app data dir");
            app.manage(AppState::new(cfg, config_path, data_dir, thumbs));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::about::get_storage_locations,
            commands::scan::scan_folder,
            commands::scan::refresh_changed_paths,
            commands::settings::get_config,
            commands::settings::set_config,
            commands::settings::reset_config,
            commands::media::request_thumbnails,
            commands::media::clear_thumbnail_queue,
            commands::media::get_metadata,
            commands::media::get_cache_stats,
            commands::media::clear_media_cache,
            commands::delete::commit_deletions,
            commands::delete::delete_files,
            commands::delete::get_deletion_history,
            commands::convert::convert_raw_to_jpg,
            commands::xmp::write_xmp_rating,
            commands::xmp::read_xmp_info,
            commands::similarity::analyze_similar_groups,
            commands::similarity::cancel_similarity_analysis,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
