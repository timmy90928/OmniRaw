use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

use serde::Serialize;
use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct XmpWriteResult {
    path: String,
    rating: i8,
}

fn create_xmp_sidecar(source: &std::path::Path, rating: i8) -> Result<PathBuf, AppError> {
    let sidecar = source.with_extension("xmp");
    let xml = format!(
        "<?xpacket begin='\u{feff}' id='W5M0MpCehiHzreSzNTczkc9d'?>\n\
<x:xmpmeta xmlns:x='adobe:ns:meta/'>\n\
  <rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'>\n\
    <rdf:Description rdf:about='' xmlns:xmp='http://ns.adobe.com/xap/1.0/' xmp:Rating='{rating}'/>\n\
  </rdf:RDF>\n\
</x:xmpmeta>\n\
<?xpacket end='w'?>\n"
    );
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&sidecar)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                AppError::Other(format!(
                    "XMP sidecar already exists and was not overwritten: {}",
                    sidecar.display()
                ))
            } else {
                error.into()
            }
        })?;
    file.write_all(xml.as_bytes())?;
    file.sync_all()?;
    Ok(sidecar)
}

/// Creates a standards-compatible XMP sidecar without replacing an existing
/// sidecar. `-1` represents Reject; `0..=5` are regular ratings.
#[tauri::command]
pub async fn write_xmp_rating(
    state: State<'_, AppState>,
    path: String,
    rating: i8,
) -> Result<XmpWriteResult, AppError> {
    if !(-1..=5).contains(&rating) {
        return Err(AppError::Other(
            "XMP rating must be between -1 and 5".into(),
        ));
    }
    let source = state.ensure_in_scan_root(PathBuf::from(&path).as_path())?;
    let sidecar = source.with_extension("xmp");
    // A sibling of a validated source remains under the scan root, but run the
    // parent through the same canonical scope boundary before creating it.
    let parent = sidecar
        .parent()
        .ok_or_else(|| AppError::Other("cannot resolve XMP parent folder".into()))?;
    let _ = state.ensure_in_scan_root(parent)?;

    let sidecar = create_xmp_sidecar(&source, rating)?;
    Ok(XmpWriteResult {
        path: sidecar.to_string_lossy().into_owned(),
        rating,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rating_range_includes_reject_and_five_stars() {
        assert!((-1..=5).contains(&-1));
        assert!((-1..=5).contains(&5));
        assert!(!(-1..=5).contains(&6));
    }

    #[test]
    fn creates_standard_rating_and_never_overwrites_existing_sidecar() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("photo.cr3");
        std::fs::write(&source, b"raw").unwrap();
        let sidecar = create_xmp_sidecar(&source, 4).unwrap();
        let first = std::fs::read_to_string(&sidecar).unwrap();
        assert!(first.contains("xmp:Rating='4'"));
        assert!(create_xmp_sidecar(&source, -1).is_err());
        assert_eq!(std::fs::read_to_string(sidecar).unwrap(), first);
    }
}
