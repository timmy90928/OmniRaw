use std::fs;
use std::path::PathBuf;

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use tauri::http::{header, Request, Response, StatusCode};
use tauri::{AppHandle, Manager, UriSchemeContext, UriSchemeResponder};

use crate::error::AppError;
use crate::model::FileKind;
use crate::preview;
use crate::state::AppState;

/// `omniraw://` routes:
///   /thumb/{b64url(abs_path)}?v={mtime}    → 256px JPEG
///   /preview/{b64url(abs_path)}?v={mtime}  → large preview (JPEG or original bytes)
/// The `v` query param only exists for browser cache-busting; content identity
/// comes from the disk-cache key (path+mtime+size).
pub fn handle<R: tauri::Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let app = ctx.app_handle().clone();
    // Never block the calling thread; decoding can take hundreds of ms.
    rayon::spawn(move || {
        let (status, mime, body) = match serve(&app, &request) {
            Ok((mime, bytes)) => (StatusCode::OK, mime, bytes),
            Err(e) => {
                log::warn!("omniraw:// request failed: {e}");
                (
                    StatusCode::NOT_FOUND,
                    "text/plain",
                    e.to_string().into_bytes(),
                )
            }
        };
        let response = Response::builder()
            .status(status)
            .header(header::CONTENT_TYPE, mime)
            .header(header::CACHE_CONTROL, "max-age=31536000, immutable")
            .body(body)
            .expect("static response parts are valid");
        responder.respond(response);
    });
}

fn serve<R: tauri::Runtime>(
    app: &AppHandle<R>,
    request: &Request<Vec<u8>>,
) -> Result<(&'static str, Vec<u8>), AppError> {
    let uri_path = request.uri().path();
    let (route, encoded) = uri_path
        .trim_start_matches('/')
        .split_once('/')
        .ok_or_else(|| AppError::Other(format!("bad route: {uri_path}")))?;

    let decoded = URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|_| AppError::Other("bad path encoding".into()))?;
    let raw_path = String::from_utf8(decoded).map_err(|_| AppError::Other("bad path utf8".into()))?;

    let state = app.state::<AppState>();
    let path: PathBuf = state.ensure_in_scan_root(PathBuf::from(raw_path).as_path())?;

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    let kind = {
        let config = state.config.read().expect("config lock poisoned");
        if config.raw_extensions.iter().any(|e| e == &ext) {
            FileKind::Raw
        } else {
            FileKind::NonRaw
        }
    };

    match route {
        "thumb" => Ok(("image/jpeg", state.thumbs().get_thumbnail(&path, kind)?)),
        "preview" => {
            if kind == FileKind::NonRaw {
                // Browser-native formats: serve original bytes untouched.
                if let Some(mime) = preview::passthrough_mime(&ext) {
                    return Ok((mime, fs::read(&path)?));
                }
            }
            Ok(("image/jpeg", state.thumbs().get_preview(&path, kind)?))
        }
        other => Err(AppError::Other(format!("unknown route: {other}"))),
    }
}
