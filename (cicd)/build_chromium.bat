@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" -Browser Chrome
exit /b %errorlevel%
