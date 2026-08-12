@echo off
setlocal EnableExtensions
title Schichtwerk
cd /d "%~dp0"

echo.
echo ========================================
echo  Schichtwerk Start (Entwicklungsmodus)
echo ========================================
echo.
echo Ordner: %CD%
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo FEHLER: Node.js nicht gefunden. Siehe INSTALLATION-WINDOWS.md
  goto :END
)

if not exist "package.json" (
  echo FEHLER: package.json fehlt. Falscher Ordner?
  goto :END
)

if not exist "node_modules\" (
  echo Pakete werden installiert ...
  call npm install
  if errorlevel 1 (
    echo FEHLER bei npm install
    goto :END
  )
)

if exist "scripts\ensure-env.cjs" (
  call node scripts\ensure-env.cjs
)

if not exist "prisma\dev.db" (
  echo Datenbank wird eingerichtet ...
  call npx prisma migrate deploy
  if errorlevel 1 (
    echo FEHLER bei der Datenbank-Einrichtung
    goto :END
  )
  call npm run db:seed
)

echo.
echo Server startet. Browser: http://localhost:3000
echo Fenster offen lassen. Beenden mit Strg+C.
echo.
call npm run dev

:END
echo.
pause
endlocal
