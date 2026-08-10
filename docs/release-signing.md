# Release signing and installer smoke tests

The `build` workflow creates a universal macOS DMG and Windows MSI/NSIS
installers. Every bundle job now validates that the installer exists and has a
plausible size. Windows silently installs and uninstalls the MSI on the
ephemeral runner. macOS mounts the DMG and validates its app bundle, executable,
dynamic-library linkage, and property list.

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

No certificate, private key, password, or token belongs in the repository.
Until all secrets are configured, macOS builds remain unsigned and the workflow
only performs bundle-structure checks.

## Windows signing (optional)

Windows packaging remains buildable without a certificate. If signing is added,
set `WINDOWS_SIGNING_REQUIRED` to `true`; the smoke test will then fail unless
the built executable has a valid Authenticode signature. Certificate import and
Tauri `bundle.windows` configuration depend on the selected certificate
provider and should be added only after that provider is chosen.
