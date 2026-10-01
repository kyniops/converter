# Sync racine → www puis optionnellement Capacitor Android
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

New-Item -ItemType Directory -Force -Path "www\js","www\css","www\icons" | Out-Null

Copy-Item "index.html" "www\index.html" -Force
Copy-Item "update.json" "www\update.json" -Force -ErrorAction SilentlyContinue
Copy-Item "manifest.json" "www\manifest.json" -Force
Copy-Item "sw.js" "www\sw.js" -Force
Copy-Item "js\*" "www\js\" -Force
Copy-Item "css\*" "www\css\" -Force
if (Test-Path "icons") { Copy-Item "icons\*" "www\icons\" -Recurse -Force }

Write-Host "www synchronisé."

if ($args -contains "-Android") {
  npx cap sync android
  Write-Host "Capacitor Android synchronisé."
}
