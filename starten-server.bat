@echo off
chcp 65001 >nul
title Schichtwerk Server
cd /d "%~dp0"

echo.
echo  ========================================
echo   Schichtwerk - Windows Server Start
echo  ========================================
echo.
echo  Dieses Fenster muss offen bleiben.
echo  Erreichbar im Netzwerk unter:
echo.
echo      http://DIESE-SERVER-IP:3000
echo.
echo  Diagnose im Browser:
echo      http://DIESE-SERVER-IP:3000/api/health
echo  ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  FEHLER: Node.js nicht gefunden. Bitte Node.js LTS installieren.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo  Pakete werden installiert ...
  call npm install
  if errorlevel 1 (
    echo  FEHLER bei npm install
    pause
    exit /b 1
  )
)

echo  Umgebungsdatei wird vorbereitet ...
call node scripts\ensure-env.cjs
if errorlevel 1 (
  echo  FEHLER beim Erstellen der .env
  pause
  exit /b 1
)

echo  Prisma Client wird erzeugt ...
call npx prisma generate
if errorlevel 1 (
  echo  FEHLER bei prisma generate
  pause
  exit /b 1
)

echo  Datenbank-Migrationen werden angewendet ...
call npx prisma migrate deploy
if errorlevel 1 (
  echo  FEHLER bei prisma migrate deploy
  echo  Tipp: Liegt der Ordner auf einem Netzlaufwerk? Besser lokal speichern.
  pause
  exit /b 1
)

if not exist "prisma\dev.db" (
  echo  FEHLER: prisma\dev.db wurde nicht erstellt.
  pause
  exit /b 1
)

REM Beispieldaten nur wenn noch keine Mitarbeiter existieren
for /f "usebackq delims=" %%A in (`node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.employee.count().then(c=>{console.log(c); return p.$disconnect()}).catch(e=>{console.log('ERR'); console.error(e); process.exit(1)})"`) do set EMPCOUNT=%%A
if "%EMPCOUNT%"=="0" (
  echo  Keine Mitarbeiter gefunden - Beispieldaten werden geladen ...
  call npm run db:seed
)

if not exist ".next\BUILD_ID" (
  echo  Produktionsbuild wird erstellt (einmalig, kann dauern) ...
  call npm run build
  if errorlevel 1 (
    echo  FEHLER beim Build
    pause
    exit /b 1
  )
)

echo.
echo  Server startet jetzt auf Port 3000 ...
echo  Firewall: Port 3000 TCP eingehend freigeben (nicht nur "Node.js").
echo.
call npx next start --hostname 0.0.0.0 --port 3000
pause
