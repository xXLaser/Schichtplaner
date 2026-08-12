@echo off
setlocal EnableExtensions
title Schichtwerk Server
cd /d "%~dp0"

echo.
echo ========================================
echo  Schichtwerk - Windows Server Start
echo ========================================
echo.
echo Projektordner:
echo %CD%
echo.
echo Dieses Fenster bleibt bei Fehlern offen.
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo FEHLER: Node.js wurde nicht gefunden.
  echo.
  echo Bitte Node.js LTS installieren von:
  echo https://nodejs.org/
  echo.
  echo Danach den PC neu starten und diese Datei erneut oeffnen.
  echo.
  goto :END
)

where npm >nul 2>&1
if errorlevel 1 (
  echo FEHLER: npm wurde nicht gefunden.
  echo Node.js bitte neu installieren und "npm" mitinstallieren lassen.
  echo.
  goto :END
)

echo Node.js Version:
node -v
echo npm Version:
npm -v
echo.

if not exist "package.json" (
  echo FEHLER: package.json fehlt.
  echo Liegt starten-server.bat wirklich im Schichtwerk-Ordner?
  echo.
  goto :END
)

if not exist "scripts\prepare-server.cjs" (
  echo FEHLER: scripts\prepare-server.cjs fehlt.
  echo Bitte den neuesten Stand des Projekts herunterladen.
  echo.
  goto :END
)

echo Vorbereitung laeuft ...
call node scripts\prepare-server.cjs
if errorlevel 1 (
  echo.
  echo FEHLER bei der Vorbereitung.
  echo Scrollen Sie nach oben und lesen Sie die rote/letzte Meldung.
  echo.
  goto :END
)

echo.
echo Server startet jetzt auf Port 3000 ...
echo Im Browser testen:
echo   http://localhost:3000/api/health
echo   http://SERVER-IP:3000/api/health
echo.
echo Firewall: Port 3000 TCP eingehend freigeben.
echo Zum Beenden: Strg+C oder Fenster schliessen.
echo.

call npx next start --hostname 0.0.0.0 --port 3000
if errorlevel 1 (
  echo.
  echo FEHLER: Server konnte nicht gestartet werden.
  echo Laeuft Port 3000 schon? Dann anderen Port testen:
  echo   npx next start --hostname 0.0.0.0 --port 3001
  echo.
)

:END
echo.
echo ---------------------------------------
echo Fenster schliesst erst nach Taste...
echo ---------------------------------------
pause
endlocal
