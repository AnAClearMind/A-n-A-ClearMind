@echo off
setlocal
cd /d "%~dp0\.."
set OUT_DIR=builds
set TEMP_DIR=%OUT_DIR%\temp_firefox
set OUT_FILE=%OUT_DIR%\ClearMind_Firefox.zip

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
if exist "%OUT_FILE%" del "%OUT_FILE%"

echo Preparing Firefox extension files...
mkdir "%TEMP_DIR%"

xcopy src\_locales "%TEMP_DIR%\_locales\" /E /I /H /Y /Q >nul
xcopy src\assets "%TEMP_DIR%\assets\" /E /I /H /Y /Q >nul
xcopy src\DB "%TEMP_DIR%\DB\" /E /I /H /Y /Q >nul
xcopy src\pages "%TEMP_DIR%\pages\" /E /I /H /Y /Q >nul
xcopy src\scripts "%TEMP_DIR%\scripts\" /E /I /H /Y /Q >nul
copy src\manifest.json "%TEMP_DIR%\" /Y >nul

echo Applying Firefox specific files...
xcopy "src\(firefox_specific)\*" "%TEMP_DIR%\" /E /I /H /Y /Q >nul

echo Building Firefox extension...
powershell -Command "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%OUT_FILE%'"

rmdir /s /q "%TEMP_DIR%"
echo Firefox build complete: %OUT_FILE%
endlocal
