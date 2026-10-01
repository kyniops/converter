# Build APK beta qui charge GitHub Pages (maj web sans réinstaller)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$config = Get-Content "js\config.js" -Raw
if ($config -notmatch "owner:\s*'([^']+)'" -and $config -notmatch 'owner:\s*"([^"]+)"') {
  Write-Error "Renseigne github.owner dans js/config.js avant le build beta."
}
$owner = $null
if ($config -match "owner:\s*'([^']+)'") { $owner = $Matches[1] }
elseif ($config -match 'owner:\s*"([^"]+)"') { $owner = $Matches[1] }
if (-not $owner) { Write-Error "github.owner vide dans js/config.js" }

$repo = "converter"
if ($config -match "repo:\s*'([^']+)'") { $repo = $Matches[1] }
elseif ($config -match 'repo:\s*"([^"]+)"') { $repo = $Matches[1] }

& "$root\scripts\sync-www.ps1"

$beta = Get-Content "capacitor.config.beta.json" -Raw
$beta = $beta -replace "GITHUB_OWNER", $owner -replace "/converter/", "/$repo/"
Copy-Item "capacitor.config.json" "capacitor.config.prod.json" -Force
Set-Content "capacitor.config.json" $beta -Encoding UTF8

try {
  npx cap sync android
  Push-Location android
  .\gradlew.bat assembleDebug
  Pop-Location
  $apk = Get-ChildItem "android\app\build\outputs\apk" -Recurse -Filter "*.apk" | Select-Object -First 1
  Write-Host ""
  Write-Host "APK beta prêt : $($apk.FullName)"
  Write-Host "Il charge https://$owner.github.io/$repo/"
  Write-Host "Installe-le UNE fois ; ensuite un push sur main met à jour l'app."
} finally {
  if (Test-Path "capacitor.config.prod.json") {
    Move-Item "capacitor.config.prod.json" "capacitor.config.json" -Force
  }
}
