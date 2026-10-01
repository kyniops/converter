# Generate Play Store upload keystore once + android/key.properties
# BACKUP android/upload-keystore.jks and passwords offline.
param(
  [string]$Password = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$android = Join-Path $root "android"
$keystore = Join-Path $android "upload-keystore.jks"
$props = Join-Path $android "key.properties"

if (Test-Path $keystore) {
  Write-Host "Keystore already exists: $keystore"
  if (-not (Test-Path $props)) {
    Write-Error "Keystore exists but key.properties is missing. Recreate it from key.properties.example."
  }
  Write-Host "OK - nothing to do."
  exit 0
}

$javaHome = $env:JAVA_HOME
if (-not $javaHome) {
  $jdk = Get-ChildItem 'C:\Program Files\Microsoft\jdk-21*' -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($jdk) { $javaHome = $jdk.FullName; $env:JAVA_HOME = $javaHome }
}
$keytool = if ($javaHome) { Join-Path $javaHome "bin\keytool.exe" } else { "keytool" }
if (-not (Get-Command $keytool -ErrorAction SilentlyContinue) -and -not (Test-Path $keytool)) {
  Write-Error "keytool not found. Install JDK 17+."
}

if (-not $Password) {
  $Password = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
  Write-Host "Generated password (also written to key.properties)."
}

& $keytool -genkeypair -v `
  -keystore $keystore `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -alias upload `
  -storepass $Password `
  -keypass $Password `
  -dname "CN=Convertisseur, OU=Mobile, O=kyniops, L=Paris, ST=IDF, C=FR"

@(
  "storePassword=$Password"
  "keyPassword=$Password"
  "keyAlias=upload"
  "storeFile=upload-keystore.jks"
) | Set-Content $props -Encoding ASCII

Write-Host ""
Write-Host "Keystore created: $keystore"
Write-Host "Config: $props"
Write-Host "BACKUP these 2 files and the password. Without them you cannot update the app on Play Store."
