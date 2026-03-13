$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$backendPath = Join-Path $root "backend"
$frontendPath = Join-Path $root "frontend"

Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
Push-Location $backendPath
npm install
Pop-Location

Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
Push-Location $frontendPath
npm install
Pop-Location

Write-Host "Setup complete. Run .\\start-local.ps1 to launch backend and frontend." -ForegroundColor Green
