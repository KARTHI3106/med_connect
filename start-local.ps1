$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$backendPath = Join-Path $root "backend"
$frontendPath = Join-Path $root "frontend"

Write-Host "Starting backend in a new terminal..." -ForegroundColor Cyan
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Set-Location '$backendPath'; npm run dev"

Write-Host "Starting frontend in a new terminal..." -ForegroundColor Cyan
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendPath'; npm run dev -- --host 127.0.0.1 --port 5173"

Write-Host "Started. Backend: http://localhost:3001/api/health | Frontend: http://127.0.0.1:5173" -ForegroundColor Green
