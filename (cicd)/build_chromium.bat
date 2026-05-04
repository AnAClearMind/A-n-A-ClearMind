@echo off
setlocal
cd /d "%~dp0\.."
set OUT_DIR=builds
set OUT_FILE=%OUT_DIR%\ClearMind_Chromium.zip

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"
if exist "%OUT_FILE%" del "%OUT_FILE%"

echo Building Chromium extension...
powershell -Command "Compress-Archive -Path src\_locales, src\assets, src\DB, src\pages, src\scripts, src\manifest.json -DestinationPath '%OUT_FILE%'"

echo Chromium build complete: %OUT_FILE%
endlocal
