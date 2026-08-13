@echo off
setlocal
cd /d "%~dp0"
title Schichtwerk (lokal)
echo Starte Schichtwerk lokal ...
echo Datenbank: %%LOCALAPPDATA%%\Schichtwerk\data\dev.db
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo FEHLER: Node.js fehlt. Bitte von https://nodejs.org installieren.
  pause
  exit /b 1
)
if not exist "dist-windows-dienst\server.js" (
  echo Baue Server-Paket ...
  call node scripts\build-windows-dienst-paket.cjs
  if errorlevel 1 (
    echo Build fehlgeschlagen.
    pause
    exit /b 1
  )
)
call node scripts\local-launcher.cjs
pause
endlocal
