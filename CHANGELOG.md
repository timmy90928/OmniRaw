# Changelog

All notable changes to OmniRaw are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **About page** with the running version and this changelog, plus in-app
  **check for updates** and one-click download-and-install (auto-update).
- **Convert RAW to JPG** for RAW-only groups: exports the RAW's embedded
  preview to a sibling `.jpg`, so the group becomes a normal pair.
- **Refresh** the current folder in place with the status-bar button or **F5** —
  no need to re-open the folder. Marks on surviving files are kept.

### Changed
- Faster culling: neighbouring previews are prefetched (instant ←/→), the
  filmstrip warms its thumbnails ahead of time, and grid scrolling drops
  work queued for rows already scrolled past.

## [0.1.0] - 2026-07-05

Initial release.

### Added
- Folder scan with RAW/JPEG pairing (same folder + same basename), including
  exported-suffix matching (`IMG_0001_edit.jpg` → `IMG_0001.CR3`).
- Keyboard-driven culling with file-level delete marks (whole pair, JPG-only,
  RAW-only, or a single file), a switchable RAW/JPG preview, and an EXIF panel.
- Review screen and Recycle-Bin deletion (`trash`), plus an orphan-cleanup view.
- RAW embedded-preview extraction (rawler), a disk-cached thumbnail/preview
  pipeline over a custom `omniraw://` protocol, and a virtualized grid browser.
- Editable RAW / non-RAW extension lists, default delete mode, and bilingual
  UI (Traditional Chinese + English) with live switching.
