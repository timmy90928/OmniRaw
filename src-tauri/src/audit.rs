use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::error::AppError;
use crate::model::{DeletionHistory, DeletionOperation, DeletionReport};
use crate::state::AppState;

pub fn record_deletion(
    state: &AppState,
    requested: Vec<String>,
    report: &DeletionReport,
) -> Result<(), AppError> {
    let root = state
        .scan_root
        .read()
        .expect("scan_root lock poisoned")
        .as_ref()
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_default();
    let operation = DeletionOperation {
        timestamp_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        scan_root: root,
        requested,
        trashed: report.trashed.clone(),
        failed: report.failed.clone(),
    };

    if let Some(parent) = state.deletion_log_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&state.deletion_log_path)?;
    serde_json::to_writer(&mut log, &operation)
        .map_err(|error| AppError::Other(error.to_string()))?;
    writeln!(log)?;

    let history = read_history(state)?;
    let json = serde_json::to_string_pretty(&history.operations)
        .map_err(|error| AppError::Other(error.to_string()))?;
    fs::write(&state.deletion_manifest_path, json)?;
    Ok(())
}

pub fn read_history(state: &AppState) -> Result<DeletionHistory, AppError> {
    let operations = match fs::File::open(&state.deletion_log_path) {
        Ok(file) => BufReader::new(file)
            .lines()
            .filter_map(|line| match line {
                Ok(line) if !line.trim().is_empty() => {
                    match serde_json::from_str::<DeletionOperation>(&line) {
                        Ok(item) => Some(item),
                        Err(error) => {
                            log::warn!("skipping malformed deletion audit line: {error}");
                            None
                        }
                    }
                }
                Ok(_) => None,
                Err(error) => {
                    log::warn!("failed to read deletion audit line: {error}");
                    None
                }
            })
            .collect(),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Vec::new(),
        Err(error) => return Err(error.into()),
    };
    Ok(DeletionHistory {
        operations,
        log_path: state.deletion_log_path.to_string_lossy().into_owned(),
        manifest_path: state.deletion_manifest_path.to_string_lossy().into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::FailedItem;

    #[test]
    fn operation_round_trips_as_one_json_line() {
        let operation = DeletionOperation {
            timestamp_ms: 42,
            scan_root: "/photos".into(),
            requested: vec!["/photos/a.jpg".into()],
            trashed: Vec::new(),
            failed: vec![FailedItem {
                path: "/photos/a.jpg".into(),
                error: "busy".into(),
            }],
        };
        let json = serde_json::to_string(&operation).unwrap();
        let restored: DeletionOperation = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.requested, operation.requested);
        assert_eq!(restored.failed.len(), 1);
    }
}
