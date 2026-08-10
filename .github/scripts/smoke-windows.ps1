$ErrorActionPreference = 'Stop'

$bundleRoot = Join-Path $PSScriptRoot '..\..\src-tauri\target'
$installers = @(Get-ChildItem -Path $bundleRoot -Recurse -File | Where-Object {
  $_.Extension -in '.msi', '.exe' -and $_.FullName -match '\bundle\'
})
if ($installers.Count -eq 0) {
  throw 'No Windows installer was produced.'
}
foreach ($installer in $installers) {
  if ($installer.Length -lt 100KB) {
    throw "Installer is unexpectedly small: $($installer.FullName)"
  }
  Write-Host "Validated installer artifact: $($installer.FullName)"
}

$msi = $installers | Where-Object Extension -eq '.msi' | Select-Object -First 1
if ($msi) {
  $install = Start-Process msiexec.exe -ArgumentList @('/i', "`"$($msi.FullName)`"", '/qn', '/norestart') -Wait -PassThru
  if ($install.ExitCode -notin 0, 3010) { throw "MSI silent install failed with $($install.ExitCode)." }
  $uninstall = Start-Process msiexec.exe -ArgumentList @('/x', "`"$($msi.FullName)`"", '/qn', '/norestart') -Wait -PassThru
  if ($uninstall.ExitCode -notin 0, 1605, 3010) { throw "MSI silent uninstall failed with $($uninstall.ExitCode)." }
  Write-Host 'MSI silent install/uninstall smoke test passed.'
}

$appBinary = Get-ChildItem -Path $bundleRoot -Recurse -File -Filter 'omniraw.exe' |
  Where-Object { $_.FullName -notmatch '\bundle\' } | Select-Object -First 1
if (-not $appBinary) { throw 'Built OmniRaw executable was not found.' }
$signature = Get-AuthenticodeSignature -LiteralPath $appBinary.FullName
Write-Host "Authenticode status: $($signature.Status)"
if ($env:REQUIRE_WINDOWS_SIGNING -eq 'true' -and $signature.Status -ne 'Valid') {
  throw 'Windows signing is required but the application signature is not valid.'
}
