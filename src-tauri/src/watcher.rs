use std::path::Path;

use notify::{EventKind, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::AppError;
use crate::state::AppState;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanChanged {
    paths: Vec<String>,
}

pub fn replace_watcher(state: &AppState, app: AppHandle, root: &Path) -> Result<(), AppError> {
    let mut watcher =
        notify::recommended_watcher(move |result: notify::Result<notify::Event>| match result {
            Ok(event) if is_content_change(&event.kind) => {
                let payload = ScanChanged {
                    paths: event
                        .paths
                        .iter()
                        .map(|path| path.to_string_lossy().into_owned())
                        .collect(),
                };
                let _ = app.emit("scan://changed", payload);
            }
            Ok(_) => {}
            Err(error) => log::warn!("folder watcher error: {error}"),
        })
        .map_err(|error| AppError::Other(format!("cannot watch folder: {error}")))?;
    watcher
        .watch(root, RecursiveMode::Recursive)
        .map_err(|error| AppError::Other(format!("cannot watch folder: {error}")))?;
    *state.watcher.lock().expect("watcher lock poisoned") = Some(watcher);
    Ok(())
}

fn is_content_change(kind: &EventKind) -> bool {
    matches!(
        kind,
        EventKind::Any | EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::{CreateKind, ModifyKind, RemoveKind};

    #[test]
    fn content_events_trigger_rescan() {
        assert!(is_content_change(&EventKind::Create(CreateKind::File)));
        assert!(is_content_change(&EventKind::Modify(ModifyKind::Any)));
        assert!(is_content_change(&EventKind::Remove(RemoveKind::File)));
        assert!(!is_content_change(&EventKind::Access(
            notify::event::AccessKind::Any
        )));
    }
}
