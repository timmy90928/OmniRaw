# Changelog

All notable changes to OmniRaw are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-08-12

### Added
- Restorable culling and library sessions, recent folders, and persisted browse
  search, filter, sort, and comparison selections.
- Zoom and pan controls in culling, plus side-by-side, overlay, and blink modes
  with synchronized transforms in Compare.
- Burst and near-duplicate detection with perceptual hashes, progress,
  cancellation, configurable thresholds, and one-click keep-one marking.
- Safe XMP rating updates that preserve existing metadata and retain a backup.
- Incremental background folder refresh, manual F5 refresh, and mark
  reconciliation when files change on disk.
- RAW-to-JPG conversion for RAW-only groups using the embedded preview without
  overwriting an existing file.
- About-page inventory of every OmniRaw storage location, including active
  scan root, settings, sessions, caches, logs, and updater temporary data.
- In-app update checking and signed release installation support.

### Changed
- Clear cache now removes every safely rebuildable cache: thumbnails, previews,
  and the persisted similarity-hash index, while preserving sessions and source
  photos.
- Thumbnail and preview caches now enforce a configurable capacity and refresh
  access times for eviction.
- Culling prefetches neighbouring previews, warms filmstrip thumbnails, and
  cancels stale grid work during fast scrolling.
- Release CI now builds unsigned artifacts on normal `main` pushes and enables
  updater signing only for `v*` release tags.

### Fixed
- Fixed the white screen caused by conditional React hook ordering after a
  folder scan completed, and added a recoverable application error boundary.
- Hardened file deletion state, case-sensitive directory boundaries, and UNC
  network-share handling while preserving the Recycle Bin-only guarantee.
- Fixed Windows and macOS bundle workflows when signing secrets are absent, and
  repaired Windows installer smoke-test path matching.

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
