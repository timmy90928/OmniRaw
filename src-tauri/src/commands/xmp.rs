use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::State;

use crate::error::AppError;
use crate::model::{XmpInfo, XmpWriteResult};
use crate::state::AppState;

fn new_xmp(rating: i8) -> String {
    format!(
        "<?xpacket begin='\u{feff}' id='W5M0MpCehiHzreSzNTczkc9d'?>\n\
<x:xmpmeta xmlns:x='adobe:ns:meta/'>\n\
  <rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'>\n\
    <rdf:Description rdf:about='' xmlns:xmp='http://ns.adobe.com/xap/1.0/' xmp:Rating='{rating}'/>\n\
  </rdf:RDF>\n\
</x:xmpmeta>\n\
<?xpacket end='w'?>\n"
    )
}

fn attribute_bounds(xml: &str, name: &str) -> Option<(usize, usize)> {
    let bytes = xml.as_bytes();
    let mut cursor = 0;
    while cursor < bytes.len() {
        let tag_start = xml[cursor..].find('<').map(|index| cursor + index)?;
        let tag_end = xml[tag_start..].find('>').map(|index| tag_start + index)?;
        let tag = &xml[tag_start + 1..tag_end];
        cursor = tag_end + 1;
        if tag.starts_with('/') || tag.starts_with('!') || tag.starts_with('?') {
            continue;
        }
        let mut position = tag.find(char::is_whitespace).unwrap_or(tag.len());
        while position < tag.len() {
            position += tag[position..].len() - tag[position..].trim_start().len();
            if position >= tag.len() || tag.as_bytes()[position] == b'/' {
                break;
            }
            let attr_start = position;
            while position < tag.len()
                && !tag.as_bytes()[position].is_ascii_whitespace()
                && tag.as_bytes()[position] != b'='
            {
                position += 1;
            }
            let attr_name = &tag[attr_start..position];
            position += tag[position..].len() - tag[position..].trim_start().len();
            if tag.as_bytes().get(position) != Some(&b'=') {
                break;
            }
            position += 1;
            position += tag[position..].len() - tag[position..].trim_start().len();
            let quote = *tag.as_bytes().get(position)?;
            if quote != b'\'' && quote != b'"' {
                break;
            }
            position += 1;
            let value_start = position;
            while position < tag.len() && tag.as_bytes()[position] != quote {
                position += 1;
            }
            if attr_name == name {
                return Some((tag_start + 1 + value_start, tag_start + 1 + position));
            }
            position += 1;
        }
    }
    None
}

fn child_bounds(xml: &str, name: &str) -> Option<(usize, usize)> {
    let open = format!("<{name}>");
    let close = format!("</{name}>");
    let start = xml.find(&open)? + open.len();
    let end = start + xml[start..].find(&close)?;
    Some((start, end))
}

fn property_bounds(xml: &str, name: &str) -> Option<(usize, usize)> {
    attribute_bounds(xml, name).or_else(|| child_bounds(xml, name))
}

fn attribute_value(xml: &str, name: &str) -> Option<String> {
    let (start, end) = property_bounds(xml, name)?;
    Some(xml[start..end].to_string())
}

fn replace_attribute(xml: &str, name: &str, value: &str) -> Option<String> {
    let (value_start, value_end) = property_bounds(xml, name)?;
    let mut output = String::with_capacity(xml.len() + value.len());
    output.push_str(&xml[..value_start]);
    output.push_str(value);
    output.push_str(&xml[value_end..]);
    Some(output)
}

fn merge_rating(xml: &str, rating: i8) -> Result<String, AppError> {
    if !xml.contains("<rdf:RDF") || !xml.contains("</rdf:RDF>") {
        return Err(AppError::Other(
            "existing XMP is not a supported RDF document; it was left unchanged".into(),
        ));
    }
    if attribute_value(xml, "xmp:Rating").is_some() {
        return replace_attribute(xml, "xmp:Rating", &rating.to_string()).ok_or_else(|| {
            AppError::Other("existing XMP rating could not be updated safely".into())
        });
    }
    let description = xml
        .find("<rdf:Description")
        .ok_or_else(|| AppError::Other("existing XMP has no rdf:Description".into()))?;
    let close = xml[description..]
        .find('>')
        .map(|index| description + index)
        .ok_or_else(|| AppError::Other("existing XMP has an incomplete rdf:Description".into()))?;
    let insert_at = if xml[..close].ends_with('/') {
        close - 1
    } else {
        close
    };
    let namespace = if xml.contains("xmlns:xmp=") {
        String::new()
    } else {
        " xmlns:xmp='http://ns.adobe.com/xap/1.0/'".to_string()
    };
    let mut output = String::with_capacity(xml.len() + 80);
    output.push_str(&xml[..insert_at]);
    output.push_str(&namespace);
    output.push_str(&format!(" xmp:Rating='{rating}'"));
    output.push_str(&xml[insert_at..]);
    Ok(output)
}

fn unique_sibling(path: &Path, suffix: &str) -> PathBuf {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let mut name = path.as_os_str().to_os_string();
    name.push(format!(".{suffix}-{}-{stamp}", std::process::id()));
    PathBuf::from(name)
}

fn atomic_write_with_backup(
    sidecar: &Path,
    xml: &str,
) -> Result<(bool, Option<PathBuf>), AppError> {
    let temp = unique_sibling(sidecar, "omniraw-tmp");
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp)?;
    file.write_all(xml.as_bytes())?;
    file.sync_all()?;
    drop(file);

    if !sidecar.exists() {
        fs::rename(&temp, sidecar)?;
        return Ok((false, None));
    }

    let backup = unique_sibling(sidecar, "omniraw-backup");
    fs::rename(sidecar, &backup)?;
    if let Err(error) = fs::rename(&temp, sidecar) {
        let _ = fs::rename(&backup, sidecar);
        let _ = fs::remove_file(&temp);
        return Err(error.into());
    }
    Ok((true, Some(backup)))
}

fn read_sidecar(sidecar: &Path) -> Result<XmpInfo, AppError> {
    if !sidecar.exists() {
        return Ok(XmpInfo {
            path: sidecar.to_string_lossy().into_owned(),
            ..XmpInfo::default()
        });
    }
    let xml = fs::read_to_string(sidecar)?;
    Ok(XmpInfo {
        path: sidecar.to_string_lossy().into_owned(),
        exists: true,
        rating: attribute_value(&xml, "xmp:Rating").and_then(|value| value.parse().ok()),
        label: attribute_value(&xml, "xmp:Label"),
    })
}

#[tauri::command]
pub async fn read_xmp_info(state: State<'_, AppState>, path: String) -> Result<XmpInfo, AppError> {
    let source = state.ensure_in_scan_root(PathBuf::from(&path).as_path())?;
    read_sidecar(&source.with_extension("xmp"))
}

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
    let parent = sidecar
        .parent()
        .ok_or_else(|| AppError::Other("cannot resolve XMP parent folder".into()))?;
    let _ = state.ensure_in_scan_root(parent)?;

    let xml = if sidecar.exists() {
        merge_rating(&fs::read_to_string(&sidecar)?, rating)?
    } else {
        new_xmp(rating)
    };
    let (updated_existing, backup) = atomic_write_with_backup(&sidecar, &xml)?;
    Ok(XmpWriteResult {
        path: sidecar.to_string_lossy().into_owned(),
        rating,
        updated_existing,
        backup_path: backup.map(|path| path.to_string_lossy().into_owned()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merges_rating_and_preserves_label() {
        let xml = "<x:xmpmeta><rdf:RDF><rdf:Description xmlns:xmp='http://ns.adobe.com/xap/1.0/' xmp:Label='Red' xmp:Rating='2'/></rdf:RDF></x:xmpmeta>";
        let merged = merge_rating(xml, 5).unwrap();
        assert_eq!(attribute_value(&merged, "xmp:Rating").as_deref(), Some("5"));
        assert_eq!(
            attribute_value(&merged, "xmp:Label").as_deref(),
            Some("Red")
        );
    }

    #[test]
    fn inserts_missing_rating_without_dropping_content() {
        let xml = "<x:xmpmeta><rdf:RDF><rdf:Description><xmpMM:History/></rdf:Description></rdf:RDF></x:xmpmeta>";
        let merged = merge_rating(xml, -1).unwrap();
        assert!(merged.contains("xmp:Rating='-1'"));
        assert!(merged.contains("<xmpMM:History/>"));
    }

    #[test]
    fn updates_child_property_without_touching_comment_text() {
        let xml = "<!-- xmp:Rating='1' --><x:xmpmeta><rdf:RDF><rdf:Description><xmp:Rating>2</xmp:Rating></rdf:Description></rdf:RDF></x:xmpmeta>";
        let merged = merge_rating(xml, 4).unwrap();
        assert!(merged.starts_with("<!-- xmp:Rating='1' -->"));
        assert!(merged.contains("<xmp:Rating>4</xmp:Rating>"));
    }

    #[test]
    fn atomic_update_keeps_backup() {
        let temp = tempfile::tempdir().unwrap();
        let sidecar = temp.path().join("photo.xmp");
        fs::write(&sidecar, "old").unwrap();
        let (updated, backup) = atomic_write_with_backup(&sidecar, "new").unwrap();
        assert!(updated);
        assert_eq!(fs::read_to_string(&sidecar).unwrap(), "new");
        assert_eq!(fs::read_to_string(backup.unwrap()).unwrap(), "old");
    }
}
