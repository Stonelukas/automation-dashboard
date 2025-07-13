# Start the File Cleanup Dashboard in Production Mode
# This script will build the frontend and start the backend server

Write-Host "Starting File Cleanup Dashboard (Production Mode)..." -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Blue
} catch {
    Write-Host "ERROR: Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Install dependencies if not already installed
if (-not (Test-Path "backend/node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    Set-Location backend
    npm install
    Set-Location ..
}

if (-not (Test-Path "frontend/node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location frontend
    npm install
    Set-Location ..
}

# Build frontend
Write-Host "Building frontend..." -ForegroundColor Yellow
Set-Location frontend
npm run build
Set-Location ..

if (-not (Test-Path "frontend/build")) {
    Write-Host "ERROR: Frontend build failed." -ForegroundColor Red
    exit 1
}

Write-Host "" -ForegroundColor Green
Write-Host "Starting production server..." -ForegroundColor Green
Write-Host "Application will be available at: http://localhost:8080" -ForegroundColor Cyan
Write-Host "" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "" -ForegroundColor Green

# Start backend server
Set-Location backend
npm start
