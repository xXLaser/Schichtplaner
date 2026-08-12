param(
  [Parameter(Mandatory = $true)]
  [string]$Destination
)

$ErrorActionPreference = "Stop"

$url = "https://nssm.cc/release/nssm-2.24.zip"
$zipPath = Join-Path $env:TEMP "nssm-download.zip"
$extractDir = Join-Path $env:TEMP "nssm-extract"

Write-Host "Lade nssm herunter ..."
Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing

if (Test-Path $extractDir) {
  Remove-Item $extractDir -Recurse -Force
}
Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

$arch = "win64"
if ([Environment]::Is64BitOperatingSystem -eq $false) {
  $arch = "win32"
}

$nssmSrc = Get-ChildItem -Path $extractDir -Recurse -Filter "nssm.exe" |
  Where-Object { $_.FullName -match $arch } |
  Select-Object -First 1

if (-not $nssmSrc) {
  $nssmSrc = Get-ChildItem -Path $extractDir -Recurse -Filter "nssm.exe" | Select-Object -First 1
}

if (-not $nssmSrc) {
  throw "nssm.exe wurde im Download nicht gefunden."
}

if (-not (Test-Path $Destination)) {
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
}

Copy-Item $nssmSrc.FullName -Destination (Join-Path $Destination "nssm.exe") -Force
Write-Host "OK: nssm.exe bereitgestellt unter $Destination"
