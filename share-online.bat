@echo off
setlocal
set "PORTABLE_NODE=%~dp0..\_tools\node-v22.11.0-win-x64"
if exist "%PORTABLE_NODE%\node.exe" (
  set "PATH=%PORTABLE_NODE%;%PATH%"
)
cd /d "%~dp0"
echo Creating public internet link for port 5173...
call npx --yes localtunnel --port 5173
pause
