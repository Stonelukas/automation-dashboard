# Start the File Cleanup Dashboard
# This script will start both the backend and frontend in development mode

Write-Host "Starting File Cleanup Dashboard..." -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Blue
} catch {
    Write-Host "ERROR: Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "npm version: $npmVersion" -ForegroundColor Blue
} catch {
    Write-Host "ERROR: npm not found. Please install npm first." -ForegroundColor Red
    exit 1
}

# Check if concurrently is installed globally, if not install it
try {
    $concurrentlyVersion = concurrently --version
    Write-Host "concurrently version: $concurrentlyVersion" -ForegroundColor Blue
} catch {
    Write-Host "Installing concurrently globally..." -ForegroundColor Yellow
    npm install -g concurrently
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

Write-Host "" -ForegroundColor Green
Write-Host "Starting development servers..." -ForegroundColor Green
Write-Host "Backend will run on: http://localhost:8080" -ForegroundColor Cyan
Write-Host "Frontend will run on: http://localhost:3000" -ForegroundColor Cyan
Write-Host "" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop both servers" -ForegroundColor Yellow
Write-Host "" -ForegroundColor Green

# Start both servers
try {
    concurrently "cd backend && npm run dev" "cd frontend && npm start" --prefix-colors "cyan,magenta" --names "backend,frontend"
} catch {
    Write-Host "ERROR: Failed to start servers. Make sure all dependencies are installed." -ForegroundColor Red
    exit 1
}
