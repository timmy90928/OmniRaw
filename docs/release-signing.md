# Release signing and installer smoke tests

The `build` workflow creates a universal macOS DMG and Windows MSI/NSIS
installers. Every bundle job now validates that the installer exists and has a
plausible size. Windows silently installs and uninstalls the MSI on the
ephemeral runner. macOS mounts the DMG and validates its app bundle, executable,
dynamic-library linkage, and property list.

Normal pushes to `main` create unsigned installer artifacts without updater
signatures. Pushes of `v*` release tags additionally enable Tauri updater
artifacts and require these repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`: the complete Tauri updater private key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: its password, or an empty value for an
  unencrypted key

The matching public key remains in `src-tauri/tauri.conf.json`. Release-tag
builds fail before compilation with a focused error when the private key is
missing.

## macOS Developer ID signing and notarization

Configure these GitHub Actions repository secrets:

- `APPLE_CERTIFICATE`: base64-encoded Developer ID Application `.p12`
- `APPLE_CERTIFICATE_PASSWORD`: password used when exporting the `.p12`
- `KEYCHAIN_PASSWORD`: a random password for the temporary CI keychain
- `APPLE_SIGNING_IDENTITY`: the full Developer ID Application identity
- `APPLE_ID`: Apple Account email
- `APPLE_PASSWORD`: app-specific password
- `APPLE_TEAM_ID`: Apple Developer Team ID

When configured, the workflow imports the certificate into a temporary
keychain. Tauri signs, notarizes, and staples the bundle. The smoke test then
requires `codesign`, Gatekeeper (`spctl`), and `stapler validate` to pass.

Apple signing is enabled only when all seven secrets are configured. A partial
configuration fails early and lists the missing secret names. No certificate,
private key, password, or token belongs in the repository. Until all secrets
are configured, macOS builds remain unsigned and the workflow only performs
bundle-structure checks.

## Windows signing (optional)

Windows packaging remains buildable without a certificate. If signing is added,
set `WINDOWS_SIGNING_REQUIRED` to `true`; the smoke test will then fail unless
the built executable has a valid Authenticode signature. Certificate import and
Tauri `bundle.windows` configuration depend on the selected certificate
provider and should be added only after that provider is chosen.
