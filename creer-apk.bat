@echo off

setlocal

cd /d "%~dp0"



set "JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"

set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"

set "ANDROID_SDK_ROOT=%ANDROID_HOME%"

set "PATH=%JAVA_HOME%\bin;%PATH%"



echo ================================

echo  Creation de l'APK Convertisseur

echo ================================

echo.



if not exist "%JAVA_HOME%\bin\java.exe" (

  echo Java 21 introuvable. Installez Microsoft OpenJDK 21.

  pause

  exit /b 1

)



echo 1/4 - Copie des fichiers web vers www...

if not exist www mkdir www

if not exist www\css mkdir www\css

if not exist www\js mkdir www\js

if not exist www\icons mkdir www\icons

copy /Y index.html manifest.json sw.js www\ >nul

xcopy /Y /E /I css www\css >nul

xcopy /Y /E /I js www\js >nul

xcopy /Y /E /I icons www\icons >nul



echo 2/4 - Generation des icones...

python tools\generate_icons.py

if errorlevel 1 (

  echo Erreur generation icones.

  pause

  exit /b 1

)



echo 3/4 - Sync Capacitor...

call npx cap sync android

if errorlevel 1 (

  echo Erreur sync Capacitor.

  pause

  exit /b 1

)



echo 4/4 - Compilation de l'APK...

cd android

call gradlew.bat clean assembleDebug --no-daemon

if errorlevel 1 (

  echo Erreur de compilation.

  pause

  exit /b 1

)



copy /Y "app\build\outputs\apk\debug\app-debug.apk" "%USERPROFILE%\Desktop\Convertisseur-v2.apk"

echo.

echo ================================

echo  APK v2.1 pret !
echo  %USERPROFILE%\Desktop\Convertisseur-v2.apk

echo ================================

echo.

echo IMPORTANT : installez Convertisseur-v2.apk
echo Supprimez aussi l'ancien raccourci navigateur si vous en avez un.

echo.

pause

