# Crée un tag vX.Y et pousse → déclenche le workflow Release APK
# Usage: .\scripts\release.ps1
#        .\scripts\release.ps1 -Version 2.10
param(
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not $Version) {
  $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
  $Version = ($pkg.version -replace '-.*$', '')
}

if ($Version -notmatch '^\d+(\.\d+)*$') {
  Write-Error "Version invalide: $Version (attendu ex: 2.10)"
}

$tag = "v$Version"
$existing = git tag -l $tag
if ($existing) {
  Write-Error "Le tag $tag existe déjà."
}

Write-Host "Push du tag $tag (workflow Release APK)..."
git tag $tag
git push origin $tag
Write-Host "OK — suis Actions sur GitHub pour l'APK + update.json"
