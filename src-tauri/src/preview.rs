use std::io::Cursor;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::Path;

use image::codecs::jpeg::JpegEncoder;
use image::DynamicImage;
use rawler::analyze::{extract_full_pixels, extract_preview_pixels, extract_thumbnail_pixels};
use rawler::decoders::RawDecodeParams;

use crate::error::AppError;
use crate::model::FileKind;

pub const THUMB_MAX_EDGE: u32 = 256;
pub const PREVIEW_MAX_EDGE: u32 = 2560;
const JPEG_QUALITY: u8 = 85;
/// Full-resolution RAW→JPG export: higher quality than screen previews, no downscale.
const EXPORT_JPEG_QUALITY: u8 = 92;

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

/// Exports a RAW's largest embedded JPEG preview as a standalone full-quality
/// JPEG (no downscale). Uses the embedded preview — fast, camera colors, and
/// already correctly oriented — rather than a full sensor demosaic. Prefers the
/// full-size embedded image, falling back to the preview image.
pub fn export_embedded_jpeg(path: &Path) -> Result<Vec<u8>, AppError> {
    let path = path.to_path_buf();
    // rawler may panic on corrupt files — contain it.
    let result = catch_unwind(AssertUnwindSafe(move || {
        let params = RawDecodeParams::default();
        extract_full_pixels(&path, &params).or_else(|_| extract_preview_pixels(&path, &params))
    }));
    let img = match result {
        Ok(Ok(img)) => img,
        Ok(Err(e)) => return Err(AppError::Other(format!("raw preview extract failed: {e}"))),
        Err(_) => return Err(AppError::Other("raw decoder panicked".into())),
    };
    encode_jpeg_quality(img, EXPORT_JPEG_QUALITY)
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
            if matches!(ext.as_str(), "heic" | "heif") {
                return load_heic(
                    path,
                    if small {
                        THUMB_MAX_EDGE
                    } else {
                        PREVIEW_MAX_EDGE
                    },
                );
            }
            image::open(path).map_err(|e| AppError::Other(format!("image decode failed: {e}")))
        }
    }
}

#[cfg(target_os = "macos")]
fn load_heic(path: &Path, max_edge: u32) -> Result<DynamicImage, AppError> {
    use std::process::Command;

    let output = tempfile::Builder::new()
        .suffix(".jpg")
        .tempfile()
        .map_err(AppError::Io)?;
    let status = Command::new("/usr/bin/sips")
        .arg("-s")
        .arg("format")
        .arg("jpeg")
        .arg("-Z")
        .arg(max_edge.to_string())
        .arg(path)
        .arg("--out")
        .arg(output.path())
        .status()
        .map_err(|error| AppError::Other(format!("ImageIO conversion failed: {error}")))?;
    if !status.success() {
        return Err(AppError::Other("ImageIO could not decode HEIC/HEIF".into()));
    }
    image::open(output.path())
        .map_err(|error| AppError::Other(format!("HEIC preview decode failed: {error}")))
}

#[cfg(windows)]
fn load_heic(path: &Path, max_edge: u32) -> Result<DynamicImage, AppError> {
    use image::RgbaImage;
    use windows::core::HSTRING;
    use windows::Win32::Foundation::SIZE;
    use windows::Win32::Graphics::Gdi::{
        DeleteObject, GetDC, GetDIBits, ReleaseDC, BITMAPINFO, BITMAPINFOHEADER, BI_RGB,
        DIB_RGB_COLORS, HGDIOBJ,
    };
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED};
    use windows::Win32::UI::Shell::{
        IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_BIGGERSIZEOK,
        SIIGBF_RESIZETOFIT,
    };

    unsafe {
        let initialized = CoInitializeEx(None, COINIT_MULTITHREADED).is_ok();
        let factory: IShellItemImageFactory =
            SHCreateItemFromParsingName(&HSTRING::from(path.as_os_str()), None).map_err(
                |error| AppError::Other(format!("Windows HEIF codec unavailable: {error}")),
            )?;
        let bitmap = factory
            .GetImage(
                SIZE {
                    cx: max_edge as i32,
                    cy: max_edge as i32,
                },
                SIIGBF_BIGGERSIZEOK | SIIGBF_RESIZETOFIT,
            )
            .map_err(|error| AppError::Other(format!("Windows HEIF preview failed: {error}")))?;

        let mut info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: 0,
                biHeight: 0,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };
        let dc = GetDC(None);
        let queried = GetDIBits(dc, bitmap, 0, 0, None, &mut info, DIB_RGB_COLORS);
        if queried == 0 || info.bmiHeader.biWidth <= 0 || info.bmiHeader.biHeight == 0 {
            let _ = ReleaseDC(None, dc);
            let _ = DeleteObject(HGDIOBJ(bitmap.0));
            if initialized {
                CoUninitialize();
            }
            return Err(AppError::Other(
                "Windows returned an invalid HEIF bitmap".into(),
            ));
        }
        let width = info.bmiHeader.biWidth as u32;
        let height = info.bmiHeader.biHeight.unsigned_abs();
        info.bmiHeader.biHeight = -(height as i32); // request top-down pixels
        let mut bgra = vec![0u8; width as usize * height as usize * 4];
        let copied = GetDIBits(
            dc,
            bitmap,
            0,
            height,
            Some(bgra.as_mut_ptr().cast()),
            &mut info,
            DIB_RGB_COLORS,
        );
        let _ = ReleaseDC(None, dc);
        let _ = DeleteObject(HGDIOBJ(bitmap.0));
        if initialized {
            CoUninitialize();
        }
        if copied == 0 {
            return Err(AppError::Other(
                "Windows could not copy the HEIF bitmap".into(),
            ));
        }
        for pixel in bgra.chunks_exact_mut(4) {
            pixel.swap(0, 2);
        }
        let image = RgbaImage::from_raw(width, height, bgra)
            .ok_or_else(|| AppError::Other("invalid HEIF pixel buffer".into()))?;
        Ok(DynamicImage::ImageRgba8(image))
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
fn load_heic(_path: &Path, _max_edge: u32) -> Result<DynamicImage, AppError> {
    Err(AppError::Other(
        "HEIC/HEIF preview requires Windows HEIF Image Extensions or macOS ImageIO".into(),
    ))
}

fn downscale(img: DynamicImage, max_edge: u32) -> DynamicImage {
    if img.width() <= max_edge && img.height() <= max_edge {
        img
    } else {
        img.thumbnail(max_edge, max_edge)
    }
}

fn encode_jpeg(img: DynamicImage) -> Result<Vec<u8>, AppError> {
    encode_jpeg_quality(img, JPEG_QUALITY)
}

fn encode_jpeg_quality(img: DynamicImage, quality: u8) -> Result<Vec<u8>, AppError> {
    // JPEG has no alpha channel; normalize to RGB8 (also flattens 16-bit RGB).
    let rgb = DynamicImage::ImageRgb8(img.to_rgb8());
    let mut buf = Vec::new();
    let mut cursor = Cursor::new(&mut buf);
    let encoder = JpegEncoder::new_with_quality(&mut cursor, quality);
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
        RgbaImage::new(1024, 512)
            .save_with_format(&src, ImageFormat::Png)
            .unwrap();

        let bytes = generate_thumbnail(&src, FileKind::NonRaw).unwrap();
        let thumb = image::load_from_memory(&bytes).unwrap();
        assert_eq!(thumb.width(), THUMB_MAX_EDGE);
        assert_eq!(thumb.height(), THUMB_MAX_EDGE / 2);
    }

    #[test]
    fn small_images_are_not_upscaled() {
        let tmp = tempfile::tempdir().unwrap();
        let src = tmp.path().join("small.png");
        RgbaImage::new(100, 80)
            .save_with_format(&src, ImageFormat::Png)
            .unwrap();

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
