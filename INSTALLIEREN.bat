@echo off
setlocal EnableExtensions
title Schichtwerk Auto-Installation
cd /d "%~dp0"

echo.
echo ========================================
echo  Schichtwerk - Automatische Installation
echo ========================================
echo.
echo Dieses Skript:
echo  1. laedt den aktuellen Programmstand
echo  2. entpackt nach C:\Schichtwerk
echo  3. startet den Server
echo.
echo Bitte Internetverbindung bereithalten.
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo FEHLER: Node.js fehlt.
  echo Bitte zuerst installieren: https://nodejs.org/
  echo Danach PC neu starten und dieses Skript erneut ausfuehren.
  goto :END
)

where tar >nul 2>&1
if errorlevel 1 (
  echo FEHLER: tar fehlt ^(unter Windows 10/11/Server normalerweise vorhanden^).
  goto :END
)

set "TARGET=C:\Schichtwerk"
set "ZIP=%TEMP%\schichtwerk-install.zip"
set "TMPDIR=%TEMP%\schichtwerk-extract"
set "BRANCH_URL=https://github.com/xXLaser/Schichtplaner/archive/refs/heads/cursor/schichtplaner-tool-94b2.zip"

echo Node.js:
node -v
echo.

echo Lade Programmstand ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '%BRANCH_URL%' -OutFile '%ZIP%' -UseBasicParsing } catch { Write-Error $_; exit 1 }"
if errorlevel 1 (
  echo FEHLER: Download fehlgeschlagen.
  echo Pruefen Sie Internet / Firewall / GitHub-Zugriff.
  goto :END
)

if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%"
mkdir "%TMPDIR%"

echo Entpacke ...
tar -xf "%ZIP%" -C "%TMPDIR%"
if errorlevel 1 (
  echo FEHLER: Entpacken fehlgeschlagen.
  goto :END
)

REM GitHub ZIP enthaelt einen Unterordner *-branchname
set "SRC="
for /d %%D in ("%TMPDIR%\Schichtplaner-*") do set "SRC=%%~fD"
if not defined SRC (
  echo FEHLER: Entpackter Projektordner nicht gefunden.
  goto :END
)

if not exist "%SRC%\package.json" (
  echo FEHLER: package.json im Download nicht gefunden.
  echo Gefunden wurde: %SRC%
  goto :END
)

echo Kopiere nach %TARGET% ...
if exist "%TARGET%\node_modules" (
  echo Bestehende Installation wird aktualisiert ...
)
if not exist "%TARGET%" mkdir "%TARGET%"

REM robocopy: Code spiegeln, lokale DB optional behalten
robocopy "%SRC%" "%TARGET%" /E /XD node_modules .next /NFL /NDL /NJH /NJS /nc /ns /np
set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 (
  echo FEHLER: Kopieren fehlgeschlagen ^(robocopy %RC%^).
  goto :END
)

echo.
echo Installation nach %TARGET% abgeschlossen.
echo Starte Server-Vorbereitung ...
echo.

cd /d "%TARGET%"
if not exist "starten-server.bat" (
  echo FEHLER: starten-server.bat fehlt in %TARGET%
  goto :END
)

call "%TARGET%\starten-server.bat"
goto :EOF

:END
echo.
echo ---------------------------------------
pause
endlocal
