use std::io::Cursor;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::Path;

use image::codecs::jpeg::JpegEncoder;
use image::DynamicImage;
use rawler::analyze::{extract_preview_pixels, extract_thumbnail_pixels};
use rawler::decoders::RawDecodeParams;

use crate::error::AppError;
use crate::model::FileKind;

pub const THUMB_MAX_EDGE: u32 = 256;
pub const PREVIEW_MAX_EDGE: u32 = 2560;
const JPEG_QUALITY: u8 = 85;

/// Extensions the `image` crate cannot decode; callers show a placeholder.
pub fn is_undecodable(ext: &str) -> bool {
    matches!(ext, "heic" | "heif")
}

/// Non-RAW formats a browser renders natively — previews serve the original
/// file bytes instead of re-encoding.
pub fn passthrough_mime(ext: &str) -> Option<&'static str> {
    match ext {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        _ => None,
    }
}

pub fn generate_thumbnail(path: &Path, kind: FileKind) -> Result<Vec<u8>, AppError> {
    let img = load_image(path, kind, true)?;
    encode_jpeg(downscale(img, THUMB_MAX_EDGE))
}

pub fn generate_preview(path: &Path, kind: FileKind) -> Result<Vec<u8>, AppError> {
    let img = load_image(path, kind, false)?;
    encode_jpeg(downscale(img, PREVIEW_MAX_EDGE))
}

fn load_image(path: &Path, kind: FileKind, small: bool) -> Result<DynamicImage, AppError> {
    match kind {
        FileKind::Raw => {
            // rawler may panic on corrupt files — contain it.
            let path = path.to_path_buf();
            let result = catch_unwind(AssertUnwindSafe(move || {
                let params = RawDecodeParams::default();
                if small {
                    extract_thumbnail_pixels(&path, &params)
                } else {
                    extract_preview_pixels(&path, &params)
                }
            }));
            match result {
                Ok(Ok(img)) => Ok(img),
                Ok(Err(e)) => Err(AppError::Other(format!("raw decode failed: {e}"))),
                Err(_) => Err(AppError::Other("raw decoder panicked".into())),
            }
        }
        FileKind::NonRaw => {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_lowercase())
                .unwrap_or_default();
            if is_undecodable(&ext) {
                return Err(AppError::Other(format!("unsupported format: {ext}")));
            }
            image::open(path).map_err(|e| AppError::Other(format!("image decode failed: {e}")))
        }
    }
}

fn downscale(img: DynamicImage, max_edge: u32) -> DynamicImage {
    if img.width() <= max_edge && img.height() <= max_edge {
        img
    } else {
        img.thumbnail(max_edge, max_edge)
    }
}

fn encode_jpeg(img: DynamicImage) -> Result<Vec<u8>, AppError> {
    // JPEG has no alpha channel; normalize to RGB8.
    let rgb = DynamicImage::ImageRgb8(img.to_rgb8());
    let mut buf = Vec::new();
    let mut cursor = Cursor::new(&mut buf);
    let encoder = JpegEncoder::new_with_quality(&mut cursor, JPEG_QUALITY);
    rgb.write_with_encoder(encoder)
        .map_err(|e| AppError::Other(format!("jpeg encode failed: {e}")))?;
    Ok(buf)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageFormat, RgbaImage};

    #[test]
    fn thumbnail_downscales_to_max_edge() {
        let tmp = tempfile::tempdir().unwrap();
        let src = tmp.path().join("big.png");
        RgbaImage::new(1024, 512).save_with_format(&src, ImageFormat::Png).unwrap();

        let bytes = generate_thumbnail(&src, FileKind::NonRaw).unwrap();
        let thumb = image::load_from_memory(&bytes).unwrap();
        assert_eq!(thumb.width(), THUMB_MAX_EDGE);
        assert_eq!(thumb.height(), THUMB_MAX_EDGE / 2);
    }

    #[test]
    fn small_images_are_not_upscaled() {
        let tmp = tempfile::tempdir().unwrap();
        let src = tmp.path().join("small.png");
        RgbaImage::new(100, 80).save_with_format(&src, ImageFormat::Png).unwrap();

        let bytes = generate_thumbnail(&src, FileKind::NonRaw).unwrap();
        let thumb = image::load_from_memory(&bytes).unwrap();
        assert_eq!((thumb.width(), thumb.height()), (100, 80));
    }

    #[test]
    fn heic_reports_unsupported() {
        let tmp = tempfile::tempdir().unwrap();
        let src = tmp.path().join("photo.heic");
        std::fs::write(&src, b"not a real heic").unwrap();
        assert!(generate_thumbnail(&src, FileKind::NonRaw).is_err());
    }

    #[test]
    fn corrupt_raw_reports_error_not_panic() {
        let tmp = tempfile::tempdir().unwrap();
        let src = tmp.path().join("broken.cr3");
        std::fs::write(&src, b"definitely not a raw file").unwrap();
        assert!(generate_thumbnail(&src, FileKind::Raw).is_err());
    }
}
