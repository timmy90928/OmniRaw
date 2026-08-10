# OmniRaw Codex instructions

Before editing this repository, read and follow the project rules in
[`CLAUDE.md`](CLAUDE.md). It is the single source of truth for architecture,
pairing behavior, deletion safety, localization, validation, and release flow.

At minimum, preserve these invariants:

- Deletion must always use the OS Recycle Bin / Trash.
- Every frontend-supplied path must be canonicalized and constrained to the
  active scan root.
- Rust DTOs and TypeScript types must remain synchronized.
- New UI copy must be added to both `zh-TW.json` and `en.json`.
- Run `npm test`, `npm run build`, `cargo fmt --all -- --check`,
  `cargo clippy --locked --all-targets -- -D warnings`, and
  `cargo test --locked` before handoff.
