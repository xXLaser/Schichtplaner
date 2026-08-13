param(
  [string]$Url = "http://localhost:3000/api/health",
  [int]$Retries = 20,
  [int]$DelaySeconds = 2
)

for ($i = 0; $i -lt $Retries; $i++) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -eq 200) {
      Write-Host "[OK] Server antwortet auf $Url" -ForegroundColor Green
      exit 0
    }
  } catch {
    # noch nicht bereit, weiter versuchen
  }
  Start-Sleep -Seconds $DelaySeconds
}

Write-Host "[FEHLER] Server antwortet nicht auf $Url" -ForegroundColor Red
exit 1
