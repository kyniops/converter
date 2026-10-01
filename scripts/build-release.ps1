# Build signed AAB for Google Play (embedded assets, store mode)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$props = Join-Path $root "android\key.properties"
$keystore = Join-Path $root "android\upload-keystore.jks"
if (-not (Test-Path $props) -or -not (Test-Path $keystore)) {
  Write-Host "Keystore missing - creating..."
  & "$root\scripts\create-keystore.ps1"
}

$configPath = Join-Path $root "js\config.js"
$configBackup = [System.IO.File]::ReadAllText($configPath)
$configStore = $configBackup -replace "distribution:\s*'sideload'", "distribution: 'store'"
if ($configStore -eq $configBackup -and $configBackup -notmatch "distribution:\s*'store'") {
  Write-Error "Could not switch distribution to 'store' in js/config.js"
}
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($configPath, $configStore, $utf8)

if (-not $env:JAVA_HOME) {
  $env:JAVA_HOME = (Get-ChildItem 'C:\Program Files\Microsoft\jdk-21*' -Directory | Select-Object -First 1).FullName
}
$sdkRoot = "$env:LOCALAPPDATA\Android\Sdk"
if (Test-Path $sdkRoot) {
  $env:ANDROID_HOME = $sdkRoot
  $sdkProp = $sdkRoot -replace '\\', '/'
  Set-Content (Join-Path $root "android\local.properties") "sdk.dir=$sdkProp" -Encoding ASCII
}

try {
  & "$root\scripts\sync-www.ps1" -Android
  Push-Location (Join-Path $root "android")
  .\gradlew.bat bundleRelease
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -ne 0) { throw "bundleRelease failed (code $code)" }

  $aab = Get-ChildItem "android\app\build\outputs\bundle\release" -Filter "*.aab" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $aab) { throw "No AAB found." }

  $desktop = [Environment]::GetFolderPath('Desktop')
  $out = Join-Path $desktop "Convertisseur-play.aab"
  Copy-Item $aab.FullName $out -Force

  Write-Host ""
  Write-Host "Play AAB ready: $($aab.FullName)"
  Write-Host "Desktop copy: $out"
  Write-Host "Upload this AAB in Google Play Console (Production or Internal testing)."
} finally {
  [System.IO.File]::WriteAllText($configPath, $configBackup, $utf8)
  & "$root\scripts\sync-www.ps1"
}
