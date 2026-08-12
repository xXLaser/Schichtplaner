@echo off
setlocal EnableExtensions
title Schichtwerk 00-START
cd /d "%~dp0"

echo.
echo ############################################################
echo #                                                          #
echo #   SCHICHTWERK  -  00-START                               #
echo #   Wenn dieser Titel NICHT erscheint,                     #
echo #   haben Sie die falsche Datei gestartet.                 #
echo #                                                          #
echo ############################################################
echo.
echo Ordner: %CD%
echo.

set FEHLER=0

if not exist "%~dp0package.json" (
  echo [X] package.json fehlt
  set FEHLER=1
) else (
  echo [OK] package.json
)

if not exist "%~dp0src\app\page.tsx" (
  echo [X] src\app\page.tsx fehlt  ^(Ordner ist unvollstaendig^)
  set FEHLER=1
) else (
  echo [OK] src\app\page.tsx
)

if not exist "%~dp0scripts\prepare-server.cjs" (
  echo [X] scripts\prepare-server.cjs fehlt
  set FEHLER=1
) else (
  echo [OK] scripts\prepare-server.cjs
)

if not exist "%~dp0prisma\schema.prisma" (
  echo [X] prisma\schema.prisma fehlt
  set FEHLER=1
) else (
  echo [OK] prisma\schema.prisma
)

echo.
where node >nul 2>&1
if errorlevel 1 (
  echo [X] Node.js fehlt - bitte von https://nodejs.org/ installieren
  set FEHLER=1
) else (
  echo [OK] Node.js
  node -v
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [X] npm fehlt
  set FEHLER=1
) else (
  echo [OK] npm
  npm -v
)

echo.
if "%FEHLER%"=="1" (
  echo ############################################################
  echo #  ABBRUCH: Das ist kein vollstaendiges Schichtwerk.       #
  echo #                                                          #
  echo #  Bitte NEU herunterladen und entpacken nach:             #
  echo #     C:\Schichtwerk                                       #
  echo #                                                          #
  echo #  Im Explorer muessen u.a. sichtbar sein:                 #
  echo #     package.json                                         #
  echo #     src                                                  #
  echo #     prisma                                               #
  echo #     scripts                                              #
  echo #     00-START.bat                                         #
  echo #                                                          #
  echo #  Download:                                               #
  echo #  https://github.com/xXLaser/Schichtplaner/archive/refs/heads/cursor/schichtplaner-tool-94b2.zip
  echo ############################################################
  echo.
  pause
  exit /b 1
)

echo Alles gefunden. Vorbereitung startet jetzt ...
echo Bitte warten - erster Start kann mehrere Minuten dauern.
echo.
call node "%~dp0scripts\prepare-server.cjs"
if errorlevel 1 (
  echo.
  echo FEHLER bei der Vorbereitung. Siehe Meldung oben.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  Server wird gestartet auf Port 3000
echo  Test im Browser:
echo    http://localhost:3000/api/health
echo  Dieses Fenster OFFEN lassen!
echo ============================================================
echo.

call npx next start --hostname 0.0.0.0 --port 3000
echo.
echo Server wurde beendet oder konnte nicht starten.
pause
endlocal
