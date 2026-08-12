@echo off
REM Oeffnet starten-server.bat und haelt die Konsole offen.
cd /d "%~dp0"
echo Starte Schichtwerk ...
echo Ordner: %CD%
echo.
if not exist "%~dp0package.json" (
  echo FEHLER: Hier liegt kein Schichtwerk.
  echo Bitte BITTE-LESEN.txt oeffnen.
  echo.
  dir
  echo.
  pause
  exit /b 1
)
cmd /k "starten-server.bat"
