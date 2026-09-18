@echo off
REM ============================================================
REM  Oasis one-click launcher (Windows).
REM  Double-click this file: it starts the local server and opens the game.
REM  Kept ASCII-only on purpose - cmd.exe mangles UTF-8 .cmd files.
REM  (chcp 65001 makes the Node output show Chinese correctly.)
REM ============================================================
setlocal
chcp 65001 >nul 2>nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [x] Node.js not found.
  echo       Install it from https://nodejs.org/ and run this file again,
  echo       or just double-click oasis-game.html ^(single file, no sound^).
  echo.
  pause
  exit /b 1
)

echo.
echo   Starting Oasis local server ... keep this window open.
echo.
node "%~dp0tools\serve.mjs" %*

echo.
echo   Server stopped.
pause
