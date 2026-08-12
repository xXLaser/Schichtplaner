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

if exist "WINDOWS-DIENST-INSTALLIEREN.bat" (
  echo [OK] WINDOWS-DIENST-INSTALLIEREN.bat gefunden
) else (
  echo [FEHLER] WINDOWS-DIENST-INSTALLIEREN.bat FEHLT
  set OK=0
)

if exist "scripts\build-windows-dienst-paket.cjs" (
  echo [OK] scripts\build-windows-dienst-paket.cjs gefunden
) else (
  echo [FEHLER] scripts\build-windows-dienst-paket.cjs FEHLT
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

if exist "Dockerfile" (
  echo [OK] Dockerfile gefunden ^(fuer Docker-Variante^)
) else (
  echo [FEHLER] Dockerfile FEHLT
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

where docker >nul 2>&1
if errorlevel 1 (
  echo [HINWEIS] Docker nicht gefunden - Windows-Dienst-Variante nutzen
) else (
  echo [OK] Docker:
  docker -v
)

echo.
echo ----------------------------------------
if "%OK%"=="1" (
  echo ERGEBNIS: Ordner ist korrekt.
  echo.
  echo Als Naechstes starten ^(als Administrator^):
  echo   WINDOWS-DIENST-INSTALLIEREN.bat
  echo.
  echo Oder mit Docker ^(falls installiert^):
  echo   docker compose up -d --build
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
