@echo off
title QLess - College Food Court
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed. QLess needs Node.js version 22.13 or newer.
  echo  The download page will open now. Install the "LTS" version, then double-click this file again.
  echo.
  start "" https://nodejs.org/en/download
  pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  echo.
  echo  Your Node.js is too old. QLess needs version 22.13 or newer.
  echo  The download page will open now. Install the "LTS" version, then try again.
  echo.
  start "" https://nodejs.org/en/download
  pause
  exit /b 1
)
echo.
echo  Starting QLess... your browser will open in a moment.
echo  If Windows asks about the firewall, tick "Private networks" and click Allow,
echo  so phones on the same Wi-Fi can open QLess.
echo.
start "" /b cmd /c "timeout /t 3 >nul & start "" http://localhost:4000"
node --disable-warning=ExperimentalWarning server\src\index.js
pause
