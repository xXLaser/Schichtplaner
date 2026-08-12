@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Schichtwerk - Windows-Dienst installieren
cd /d "%~dp0"

echo.
echo ================================================================
echo  Schichtwerk als Windows-Dienst installieren (ohne Docker)
echo ================================================================
echo.
echo Ordner: %CD%
echo ================================================================
echo.

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo FEHLER: Bitte diese Datei per Rechtsklick -^> "Als Administrator ausfuehren" starten.
  echo Ein Windows-Dienst kann nur mit Administratorrechten eingerichtet werden.
  goto :END
)

if not exist "package.json" (
  echo FEHLER: package.json fehlt. Bitte im Schichtwerk-Hauptordner ausfuehren.
  goto :END
)

where node >nul 2>&1
if errorlevel 1 (
  echo FEHLER: Node.js fehlt. Bitte zuerst https://nodejs.org/ installieren.
  goto :END
)

for /f "delims=" %%N in ('where node') do (
  set "NODE_EXE=%%N"
  goto :NODE_FOUND
)
:NODE_FOUND
echo Node.js gefunden unter: %NODE_EXE%
node -v
echo.

if not exist "node_modules\" (
  echo node_modules fehlt - Pakete werden installiert ...
  echo ^(dies kann beim ersten Mal mehrere Minuten dauern^)
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo FEHLER bei npm install.
    echo Pruefen Sie die Internetverbindung des Servers.
    goto :END
  )
)

set "NSSM_DIR=%~dp0tools\nssm"
set "NSSM_EXE=%NSSM_DIR%\nssm.exe"

if not exist "%NSSM_EXE%" (
  echo nssm.exe ^(Dienst-Werkzeug^) nicht gefunden - wird heruntergeladen ...
  mkdir "%NSSM_DIR%" >nul 2>&1
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\download-nssm.ps1" -Destination "%NSSM_DIR%"
  if errorlevel 1 (
    echo.
    echo FEHLER: nssm.exe konnte nicht automatisch heruntergeladen werden.
    echo Bitte manuell laden von https://nssm.cc/download und nssm.exe
    echo hierhin legen: %NSSM_EXE%
    echo Danach dieses Skript erneut starten.
    goto :END
  )
)

if not exist "%NSSM_EXE%" (
  echo FEHLER: nssm.exe fehlt weiterhin unter %NSSM_EXE%
  goto :END
)

echo.
echo Baue eigenstaendiges Server-Paket ...
call node scripts\build-windows-dienst-paket.cjs
if errorlevel 1 (
  echo FEHLER beim Erstellen des Server-Pakets.
  goto :END
)

set "APP_DIR=%~dp0dist-windows-dienst"
set "SERVICE_NAME=Schichtwerk"

echo.
echo Richte Datenbank ein ^(Migrationen anwenden - unschaedlich, falls bereits aktuell^) ...
pushd "%APP_DIR%"
set "DATABASE_URL=file:%APP_DIR%\prisma\dev.db"
call node node_modules\prisma\build\index.js migrate deploy
if errorlevel 1 (
  echo FEHLER bei der Datenbank-Migration.
  popd
  goto :END
)
popd

echo.
echo Entferne evtl. vorhandenen alten Dienst ...
"%NSSM_EXE%" stop %SERVICE_NAME% >nul 2>&1
"%NSSM_EXE%" remove %SERVICE_NAME% confirm >nul 2>&1

echo Installiere Windows-Dienst "%SERVICE_NAME%" ...
"%NSSM_EXE%" install %SERVICE_NAME% "%NODE_EXE%" "windows-dienst-start.cjs"
if errorlevel 1 (
  echo FEHLER: Dienst konnte nicht installiert werden.
  goto :END
)

"%NSSM_EXE%" set %SERVICE_NAME% AppDirectory "%APP_DIR%"
"%NSSM_EXE%" set %SERVICE_NAME% AppEnvironmentExtra "PORT=3000" "HOSTNAME=0.0.0.0" "DATABASE_URL=file:%APP_DIR%\prisma\dev.db" "NODE_ENV=production"
"%NSSM_EXE%" set %SERVICE_NAME% Start SERVICE_AUTO_START
"%NSSM_EXE%" set %SERVICE_NAME% AppStdout "%APP_DIR%\dienst-log.txt"
"%NSSM_EXE%" set %SERVICE_NAME% AppStderr "%APP_DIR%\dienst-fehler.txt"
"%NSSM_EXE%" set %SERVICE_NAME% AppRestartDelay 3000
"%NSSM_EXE%" set %SERVICE_NAME% DisplayName "Schichtwerk Dienstplan-Server"
"%NSSM_EXE%" set %SERVICE_NAME% Description "Schichtwerk Dienstplan- und Urlaubsplaner (Next.js). Erreichbar unter http://SERVER-IP:3000"

echo.
echo Starte Dienst ...
"%NSSM_EXE%" start %SERVICE_NAME%

echo.
echo Pruefe, ob der Dienst wirklich antwortet ^(kann etwas dauern^) ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\check-health.ps1"
set "HEALTH_OK=%errorlevel%"

echo.
echo ================================================================
if "%HEALTH_OK%"=="0" (
  echo  FERTIG - Server laeuft
) else (
  echo  ACHTUNG - Dienst installiert, antwortet aber noch NICHT
  echo  Bitte pruefen:
  echo    %NSSM_EXE% status %SERVICE_NAME%
  echo    Log ansehen: %APP_DIR%\dienst-fehler.txt
)
echo ================================================================
echo  Dienstname:    %SERVICE_NAME%
echo  Programmordner: %APP_DIR%
echo  Log-Dateien:    %APP_DIR%\dienst-log.txt
echo                  %APP_DIR%\dienst-fehler.txt
echo.
echo  Test im Browser:
echo    http://localhost:3000/api/health
echo    http://SERVER-IP:3000/api/health
echo.
echo  Der Dienst startet ab jetzt automatisch mit Windows,
echo  auch ohne offenes Fenster.
echo.
echo  Verwaltung:
echo    services.msc  ^(Dienst "%SERVICE_NAME%" suchen^)
echo    oder: tools\nssm\nssm.exe status %SERVICE_NAME%
echo ================================================================

:END
echo.
pause
endlocal
