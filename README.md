# OmniRaw

[![build](https://github.com/timmy90928/OmniRaw/actions/workflows/build.yml/badge.svg)](https://github.com/timmy90928/OmniRaw/actions/workflows/build.yml)

A cross-platform (Windows / macOS) photo-culling tool that keeps RAW and non-RAW file lifecycles **linked**. Delete a JPG and its matching RAW goes with it — no more orphaned RAW files silently eating your disk.

## The problem it solves

If you shoot RAW+JPEG, most viewers let you cull by browsing JPGs — but deleting a JPG leaves its `.CR3`/`.ARW`/`.NEF` sibling behind. Over time your library fills with RAW files whose JPGs are long gone (and vice versa). OmniRaw treats the RAW, the camera JPG, and any edited exports of the same shot as **one group**, so a single decision applies to all of them — or to exactly the files you pick.

## Features

- **Pair-aware scanning** — recursive folder scan groups files by basename (case-insensitive, same folder). Exported variants like `IMG_0001_edit.jpg` or `IMG_0001-1.jpg` automatically join `IMG_0001.CR3`'s group (longest-prefix match; `IMG_00010.jpg` is correctly treated as a different photo).
- **Fast previews** — RAW thumbnails come from the embedded JPEG preview (no full RAW decode), generated on a parallel worker pool with a persistent disk cache. Virtualized grid stays smooth on large folders.
- **Keyboard-driven culling** — flip through photos, mark deletions, and cycle between every file in a group (camera JPG ↔ exports ↔ RAW) without touching the mouse.
- **File-level deletion control** — delete the whole group, JPGs only, RAW only, or hand-pick individual files. A review screen shows exactly which files will go before anything happens.
- **Recycle-bin only** — every deletion goes to the OS Recycle Bin / Trash. Nothing is permanently deleted; everything is recoverable.
- **Orphan cleanup** — dedicated screen listing RAW-without-JPG and JPG-without-RAW files for batch cleanup.
- **EXIF panel** — camera, lens, shutter, aperture, ISO, focal length, capture time and dimensions (CR3 metadata included).
- **Configurable** — editable RAW / non-RAW extension lists, default Delete-key behavior, export-suffix grouping toggle.
- **Bilingual UI** — 繁體中文 (default) and English, switchable at runtime.

## Download & Install

Grab the latest installer from [GitHub Releases](https://github.com/timmy90928/OmniRaw/releases):

| Platform | File | Notes |
|---|---|---|
| Windows 10/11 | `OmniRaw_x.y.z_x64-setup.exe` (or `.msi`) | |
| macOS (Apple Silicon & Intel) | `OmniRaw_x.y.z_universal.dmg` | Unsigned — see below |

> **macOS note**: builds are currently unsigned. If macOS blocks the app, clear
> the quarantine flag after copying it to Applications:
> `xattr -cr /Applications/OmniRaw.app`

Development snapshots for every `main` commit are available as workflow artifacts on the [Actions page](https://github.com/timmy90928/OmniRaw/actions).

## Usage

1. **Browse** — open a folder; OmniRaw scans it recursively and shows a thumbnail grid. Each card is one *group* (RAW + JPGs of the same shot) with a status badge: `Paired` / `RAW only` / `JPG only`.
2. **Cull** — click any photo (or press Enter) to enter the full-screen culling view and work through the folder with the keyboard.
3. **Review** — see every marked file, fine-tune with per-file checkboxes, then commit. Files move to the Recycle Bin with progress and a per-file failure report.
4. **Orphan Cleanup** — batch-select leftover RAW-only / JPG-only files and trash them.
5. **Settings** — language, extension lists, Delete-key default mode, export grouping.

### Keyboard shortcuts (culling view)

| Key | Action |
|---|---|
| ← / → | Previous / next photo |
| **Delete** / Backspace / X | Mark whole group for deletion (press again to unmark) — uses the default mode from Settings |
| J | Mark JPGs only (keep RAW) |
| R | Mark RAW only (keep JPGs) |
| **Space** | Toggle mark on the *currently viewed file* only |
| P or ↑ / ↓ | Cycle through the files in the group (camera JPG → exports → RAW) |
| U | Unmark this group |
| Enter | Go to Review |
| Esc | Back to Browse |

Marking with Delete/J/R auto-advances to the next photo, so a full cull pass is just arrows + one key per shot.

### Pairing rules

```
photos/
├── IMG_0001.CR3        ─┐
├── IMG_0001.JPG         │  one group (camera pair + exports)
├── IMG_0001_edit.jpg    │
├── IMG_0001-1.jpg      ─┘
├── IMG_0002.CR3         ←  RAW orphan (no JPG)
├── IMG_00010.jpg        ←  different photo — numeric continuation is NOT an export
└── sub/IMG_0001.JPG     ←  different folder — never pairs across folders
```

- Same folder + same basename (case-insensitive) = one group.
- A non-RAW file whose name is *RAW basename + separator + suffix* joins that RAW's group (`-`, `_`, space, `(`, etc.). The longest matching RAW basename wins, so `IMG_0001-1-edit.jpg` pairs with `IMG_0001-1.CR3`, not `IMG_0001.CR3`.
- Toggleable in Settings (`Auto-group exported files`).

## Configuration

Settings persist to a JSON file:

- Windows: `%APPDATA%\com.omniraw.app\config.json`
- macOS: `~/Library/Application Support/com.omniraw.app/config.json`

| Field | Default | Meaning |
|---|---|---|
| `rawExtensions` | dng, cr2, cr3, nef, nrw, arw, orf, raf, rw2, pef, srw, x3f, 3fr, iiq | Treated as RAW |
| `nonRawExtensions` | jpg, jpeg, png, heic, heif, tif, tiff, webp | Treated as non-RAW |
| `defaultDeleteMode` | `pair` | What the Delete key marks: `pair` / `nonRawOnly` / `rawOnly` |
| `matchExportedSuffixes` | `true` | Exported-file prefix matching |
| `language` | `zh-TW` | UI language (`zh-TW` / `en`) |

Thumbnail cache lives in the platform cache dir (`%LOCALAPPDATA%\com.omniraw.app` on Windows) and is safe to delete at any time.

## Development

Prerequisites: Node.js 22+, Rust (via [rustup](https://rustup.rs)). Windows additionally needs MSVC Build Tools; macOS needs Xcode Command Line Tools (`xcode-select --install`).

```sh
git clone https://github.com/timmy90928/OmniRaw.git
cd OmniRaw
npm install
npm run tauri dev    # run locally with hot reload
```

Tests and type checks:

```sh
cargo test           # in src-tauri/ — pairing engine, cache keys, deletion expansion
npx tsc --noEmit     # frontend type check
```

### CI-first packaging

Packaging is fully automated on GitHub Actions — no local `tauri build` needed:

- every push / PR runs Rust tests + the TypeScript build (Ubuntu gate)
- pushes to `main` produce macOS (`.dmg`, universal) and Windows (`.exe`/`.msi`) bundles as workflow artifacts
- pushing a `v*` tag publishes a GitHub Release with all installers attached

### Architecture (short version)

Tauri 2 + Rust backend · React 19 + TypeScript + Vite frontend.

- **RAW decoding**: [rawler](https://crates.io/crates/rawler) extracts embedded JPEG previews and CR3 metadata (version pinned; isolated in `preview.rs` / `exif.rs`)
- **Deletion**: [trash](https://crates.io/crates/trash) crate — recycle bin only
- **Image transport**: custom `omniraw://` URI scheme with an immutable-cache disk layer keyed by `blake3(path + mtime + size)`
- **Concurrency**: rayon worker pool for thumbnail generation, progress via Tauri events
- **State**: zustand stores; file-level mark model (`Map<groupId, Set<filePath>>`)

Detailed layout and project conventions live in [CLAUDE.md](CLAUDE.md).

## Known limitations

- **HEIC/HEIF**: shown as a placeholder (no decoder bundled in v1); metadata still works where available.
- **macOS builds are unsigned** (no Apple Developer certificate yet) — see the install note above.
- Pairing never crosses folder boundaries by design; a `RAW/` subfolder workflow is not yet supported.

## Roadmap ideas

- HEIC thumbnail decoding
- macOS code signing & notarization
- Sort / filter in the browse grid
- Optional subfolder pairing (`RAW/` sidecar layout)

## License

[MIT](LICENSE)
