@echo off
cd /d "%~dp0"
echo Generation des icones...
python tools\generate_icons.py
if errorlevel 1 (
    echo Erreur generation icones.
    pause
    exit /b 1
)
echo.
echo Installation des dependances...
python -m pip install cryptography Pillow -q
echo.
echo Demarrage du serveur HTTPS...
python tools\serve_https.py
pause
