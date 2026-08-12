@echo off
chcp 65001 >nul
title Schichtwerk
cd /d "%~dp0"

echo.
echo  ========================================
echo   Schichtwerk wird gestartet ...
echo  ========================================
echo.
echo  Bitte dieses Fenster offen lassen.
echo  Danach im Browser oeffnen:
echo.
echo      http://localhost:3000
echo.
echo  Zum Beenden: Fenster schliessen
echo  oder Strg+C druecken.
echo  ========================================
echo.

if not exist "node_modules\" (
  echo  Erster Start: Pakete werden installiert ...
  call npm install
  if errorlevel 1 (
    echo.
    echo  FEHLER bei npm install.
    echo  Ist Node.js installiert? Siehe INSTALLATION-WINDOWS.md
    pause
    exit /b 1
  )
)

if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo  Datei .env wurde aus .env.example erstellt.
  )
)

if not exist "prisma\dev.db" (
  echo  Datenbank wird eingerichtet ...
  call npx prisma migrate dev --name init
  if errorlevel 1 (
    echo.
    echo  FEHLER bei der Datenbank-Einrichtung.
    pause
    exit /b 1
  )
  echo  Beispieldaten werden geladen ...
  call npm run db:seed
)

call npm run dev
pause
