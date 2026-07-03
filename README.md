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

## Development

```sh
npm install
npm run tauri dev    # requires Rust (rustup, MSVC on Windows)
npm run tauri build  # production installer
```

Project layout and conventions: see [CLAUDE.md](CLAUDE.md) (detailed source of truth).
