# OmniRaw

A cross-platform (Windows / macOS) photo culling tool that keeps RAW and non-RAW file lifecycles linked — delete a JPG and its matching RAW goes with it, plus orphan-file cleanup.

## Features (v1)

- Folder scan with RAW/non-RAW pairing (same folder + same basename)
- Keyboard-driven culling: X delete pair, J delete JPG only, R delete RAW only, P toggle RAW/JPG preview
- Fast previews via embedded JPEG extraction (no full RAW decode)
- Orphan cleanup (RAW without JPG, and vice versa)
- All deletions go to the OS recycle bin (reversible)
- Bilingual UI: 繁體中文 (default) / English
- Configurable RAW / non-RAW extension lists

## Stack

Tauri 2 + Rust backend (rawler, trash, rayon) · React 19 + TypeScript + Vite frontend (zustand, TanStack Virtual, i18next)

## Download & Install

Grab the latest installer from [GitHub Releases](https://github.com/timmy90928/OmniRaw/releases):

- **Windows**: `OmniRaw_x.y.z_x64-setup.exe`
- **macOS** (Apple Silicon & Intel, universal): `OmniRaw_x.y.z_universal.dmg`

> **macOS note**: builds are currently unsigned. If macOS blocks the app,
> clear the quarantine flag after copying it to Applications:
> `xattr -cr /Applications/OmniRaw.app`

## Development

Prerequisites: Node.js 22+, Rust (via [rustup](https://rustup.rs)). Windows additionally needs MSVC Build Tools; macOS needs Xcode Command Line Tools (`xcode-select --install`).

```sh
npm install
npm run tauri dev    # run locally with hot reload
```

Packaging is fully automated on GitHub Actions — no local `tauri build` needed:

- every push / PR runs Rust tests + TypeScript build
- pushes to `main` produce macOS (.dmg, universal) and Windows (.exe/.msi) bundles as workflow artifacts
- pushing a `v*` tag publishes a GitHub Release with all installers attached

Project layout and conventions: see [CLAUDE.md](CLAUDE.md) (detailed source of truth).
