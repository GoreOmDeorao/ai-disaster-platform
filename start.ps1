# AI Disaster Platform — Windows starter (PowerShell)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  AI Disaster Response Platform" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

try {
    docker info | Out-Null
} catch {
    Write-Host "Docker is not running. Start Docker Desktop and retry." -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 1: Infrastructure (Kafka, PostgreSQL, Redis)..." -ForegroundColor Yellow
Set-Location (Join-Path $root "infra")
docker compose up -d
Set-Location $root

Write-Host "`nWaiting for containers..." -ForegroundColor Gray
Start-Sleep -Seconds 12

Write-Host "`nStep 2: Backend (Go) — run in a separate terminal:" -ForegroundColor Yellow
Write-Host "  cd backend; `$env:DATABASE_URL='postgres://disaster_user:disaster_pass@127.0.0.1:5432/disaster_db?sslmode=disable'; go run ./cmd/server" -ForegroundColor White

Write-Host "`nStep 3: ML service — run in a separate terminal:" -ForegroundColor Yellow
Write-Host "  cd ml-service; .\venv\Scripts\Activate.ps1; pip install -r requirements.txt; uvicorn server:app --host 0.0.0.0 --port 8001" -ForegroundColor White

Write-Host "`nStep 4: Sensor simulator — optional terminal:" -ForegroundColor Yellow
Write-Host "  cd sensor-simulator; pip install kafka-python; python main.py" -ForegroundColor White

Write-Host "`nStep 5: Frontend — run in a separate terminal:" -ForegroundColor Yellow
Write-Host "  cd frontend; npm start" -ForegroundColor White

Write-Host "`nAPI: http://127.0.0.1:8080/health | ML: http://127.0.0.1:8001/health" -ForegroundColor Green
