@echo off
setlocal EnableExtensions
title Schichtwerk Pruefung
cd /d "%~dp0"

echo.
echo ========================================
echo  Schichtwerk - Installation pruefen
echo ========================================
echo.
echo Aktueller Ordner:
echo %CD%
echo.

set OK=1

if exist "package.json" (
  echo [OK] package.json gefunden
) else (
  echo [FEHLER] package.json FEHLT
  echo          Sie sind im falschen Ordner!
  set OK=0
)

if exist "starten-server.bat" (
  echo [OK] starten-server.bat gefunden
) else (
  echo [FEHLER] starten-server.bat FEHLT
  set OK=0
)

if exist "scripts\prepare-server.cjs" (
  echo [OK] scripts\prepare-server.cjs gefunden
) else (
  echo [FEHLER] scripts\prepare-server.cjs FEHLT
  echo          Das ist nicht der aktuelle Schichtwerk-Stand.
  set OK=0
)

if exist "src\app\page.tsx" (
  echo [OK] src\app gefunden
) else (
  echo [FEHLER] Quellcode-Ordner src\app FEHLT
  set OK=0
)

if exist "prisma\schema.prisma" (
  echo [OK] prisma\schema.prisma gefunden
) else (
  echo [FEHLER] prisma\schema.prisma FEHLT
  set OK=0
)

echo.
where node >nul 2>&1
if errorlevel 1 (
  echo [FEHLER] Node.js ist NICHT installiert oder nicht im PATH
  set OK=0
) else (
  echo [OK] Node.js:
  node -v
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [FEHLER] npm fehlt
  set OK=0
) else (
  echo [OK] npm:
  npm -v
)

echo.
echo ----------------------------------------
if "%OK%"=="1" (
  echo ERGEBNIS: Ordner ist korrekt.
  echo.
  echo Als Naechstes starten:
  echo   starten-server-fenster-offen.bat
) else (
  echo ERGEBNIS: Installation ist NICHT bereit.
  echo.
  echo BITTE SO BEHEBEN:
  echo 1. Neuen Stand herunterladen ^(nicht den alten ZIP-Wirrwarr^)
  echo 2. ZIP nach C:\Schichtwerk entpacken
  echo 3. In C:\Schichtwerk muss package.json liegen
  echo 4. Dort PRUEFEN.bat erneut ausfuehren
  echo.
  echo Download Branch:
  echo https://github.com/xXLaser/Schichtplaner/archive/refs/heads/cursor/schichtplaner-tool-94b2.zip
)
echo ----------------------------------------
echo.
pause
endlocal
