#!/usr/bin/env bash
set -euo pipefail

bundle_root="$(cd "$(dirname "$0")/../../src-tauri/target" && pwd)"
dmg="$(find "$bundle_root" -type f -path '*/bundle/dmg/*.dmg' -print -quit)"
test -n "$dmg" || { echo 'No macOS DMG was produced.' >&2; exit 1; }
test "$(stat -f '%z' "$dmg")" -gt 102400 || { echo 'DMG is unexpectedly small.' >&2; exit 1; }

mount_dir="$(mktemp -d)"
cleanup() {
  hdiutil detach "$mount_dir" -quiet || true
  rmdir "$mount_dir" 2>/dev/null || true
}
trap cleanup EXIT
hdiutil attach "$dmg" -readonly -nobrowse -mountpoint "$mount_dir" -quiet
app="$(find "$mount_dir" -maxdepth 1 -type d -name '*.app' -print -quit)"
test -n "$app" || { echo 'DMG does not contain an app bundle.' >&2; exit 1; }
plutil -lint "$app/Contents/Info.plist"
executable_name="$(defaults read "$app/Contents/Info" CFBundleExecutable)"
test -x "$app/Contents/MacOS/$executable_name"
otool -L "$app/Contents/MacOS/$executable_name" >/dev/null

if [[ "${REQUIRE_APPLE_SIGNING:-false}" == 'true' ]]; then
  codesign --verify --deep --strict --verbose=2 "$app"
  spctl --assess --type execute --verbose=2 "$app"
  xcrun stapler validate "$app"
  echo 'Developer ID signature, Gatekeeper assessment, and notarization ticket are valid.'
else
  echo 'Bundle structure passed; Apple signing checks skipped because credentials are not configured.'
fi
