use std::fs::File;
use std::io::BufReader;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::Path;

use exif::{In, Tag, Value};
use rawler::decoders::RawDecodeParams;
use rawler::rawsource::RawSource;

use crate::model::{ExifData, FileKind};

/// Single metadata entry point. kamadak-exif covers JPEG/TIFF-based files;
/// formats it can't parse (e.g. CR3) fall back to rawler for RAW files.
/// Always returns a value — missing metadata shows as empty fields.
pub fn read_exif(path: &Path, kind: FileKind) -> ExifData {
    if let Some(data) = read_kamadak(path) {
        if data.camera_model.is_some() || data.exposure_time.is_some() {
            return data;
        }
    }
    if kind == FileKind::Raw {
        if let Some(data) = read_rawler(path) {
            return data;
        }
    }
    ExifData::default()
}

fn read_kamadak(path: &Path) -> Option<ExifData> {
    let file = File::open(path).ok()?;
    let exif = exif::Reader::new()
        .read_from_container(&mut BufReader::new(file))
        .ok()?;

    Some(ExifData {
        camera_make: ascii(&exif, Tag::Make),
        camera_model: ascii(&exif, Tag::Model),
        lens_model: ascii(&exif, Tag::LensModel),
        exposure_time: rational(&exif, Tag::ExposureTime).map(format_exposure),
        f_number: rational(&exif, Tag::FNumber).map(|f| format!("{:.1}", f)),
        iso: uint(&exif, Tag::PhotographicSensitivity),
        focal_length_mm: rational(&exif, Tag::FocalLength),
        date_taken: ascii(&exif, Tag::DateTimeOriginal)
            .or_else(|| ascii(&exif, Tag::DateTime)),
        width: uint(&exif, Tag::PixelXDimension).or_else(|| uint(&exif, Tag::ImageWidth)),
        height: uint(&exif, Tag::PixelYDimension).or_else(|| uint(&exif, Tag::ImageLength)),
    })
}

fn read_rawler(path: &Path) -> Option<ExifData> {
    let path = path.to_path_buf();
    let result = catch_unwind(AssertUnwindSafe(move || {
        let source = RawSource::new(&path).ok()?;
        let decoder = rawler::get_decoder(&source).ok()?;
        decoder
            .raw_metadata(&source, &RawDecodeParams::default())
            .ok()
    }));
    let md = result.ok().flatten()?;

    let to_f32 = |r: rawler::formats::tiff::Rational| {
        if r.d == 0 {
            None
        } else {
            Some(r.n as f32 / r.d as f32)
        }
    };

    Some(ExifData {
        camera_make: Some(md.make.clone()).filter(|s| !s.is_empty()),
        camera_model: Some(md.model.clone()).filter(|s| !s.is_empty()),
        lens_model: md
            .lens
            .as_ref()
            .map(|l| l.lens_model.clone())
            .filter(|s| !s.is_empty()),
        exposure_time: md.exif.exposure_time.and_then(to_f32).map(format_exposure),
        f_number: md
            .exif
            .fnumber
            .and_then(to_f32)
            .map(|f| format!("{:.1}", f)),
        iso: md
            .exif
            .iso_speed_ratings
            .map(u32::from)
            .or(md.exif.iso_speed),
        focal_length_mm: md.exif.focal_length.and_then(to_f32),
        date_taken: md.exif.date_time_original.clone(),
        width: None,
        height: None,
    })
}

/// "1/200" for fast shutters, "2.5s" for long exposures.
fn format_exposure(seconds: f32) -> String {
    if seconds <= 0.0 {
        String::new()
    } else if seconds < 1.0 {
        format!("1/{}", (1.0 / seconds).round() as u32)
    } else {
        format!("{:.1}s", seconds)
    }
}

fn ascii(exif: &exif::Exif, tag: Tag) -> Option<String> {
    let field = exif.get_field(tag, In::PRIMARY)?;
    match &field.value {
        Value::Ascii(chunks) => chunks.first().map(|bytes| {
            String::from_utf8_lossy(bytes)
                .trim_matches(['\0', ' '])
                .to_string()
        }),
        _ => None,
    }
    .filter(|s| !s.is_empty())
}

fn uint(exif: &exif::Exif, tag: Tag) -> Option<u32> {
    exif.get_field(tag, In::PRIMARY)
        .and_then(|f| f.value.get_uint(0))
}

fn rational(exif: &exif::Exif, tag: Tag) -> Option<f32> {
    let field = exif.get_field(tag, In::PRIMARY)?;
    match &field.value {
        Value::Rational(v) => v.first().map(|r| r.to_f32()),
        Value::SRational(v) => v.first().map(|r| r.to_f32()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposure_formatting() {
        assert_eq!(format_exposure(0.005), "1/200");
        assert_eq!(format_exposure(0.5), "1/2");
        assert_eq!(format_exposure(2.5), "2.5s");
    }

    #[test]
    fn unreadable_file_yields_empty_data() {
        let tmp = tempfile::tempdir().unwrap();
        let f = tmp.path().join("x.jpg");
        std::fs::write(&f, b"junk").unwrap();
        let data = read_exif(&f, FileKind::NonRaw);
        assert!(data.camera_model.is_none());
    }
}
