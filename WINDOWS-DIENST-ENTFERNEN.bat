@echo off
setlocal EnableExtensions
title Schichtwerk-Dienst entfernen
cd /d "%~dp0"

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Bitte per Rechtsklick -^> "Als Administrator ausfuehren" starten.
  pause
  exit /b 1
)

set "NSSM_EXE=%~dp0tools\nssm\nssm.exe"
set "SERVICE_NAME=Schichtwerk"

if not exist "%NSSM_EXE%" (
  echo nssm.exe nicht gefunden unter %NSSM_EXE%
  pause
  exit /b 1
)

echo Stoppe und entferne Dienst "%SERVICE_NAME%" ...
"%NSSM_EXE%" stop %SERVICE_NAME%
"%NSSM_EXE%" remove %SERVICE_NAME% confirm

echo.
echo Fertig.
pause
endlocal
