# DeliverIt AI - Start Backend Server
# Created by Aditya Upadhyay

Write-Host "🚀 Starting DeliverIt AI Backend Server..." -ForegroundColor Green
Write-Host "👨‍💻 Created by: Aditya Upadhyay" -ForegroundColor Cyan
Write-Host "🏢 Company: DeliverIt" -ForegroundColor Yellow

# Check if we're in the correct directory
if (-not (Test-Path "backend\package.json")) {
    Write-Host "❌ Error: Please run this script from the project root directory" -ForegroundColor Red
    Write-Host "Expected structure: .\backend\package.json" -ForegroundColor Yellow
    exit 1
}

# Change to backend directory
Set-Location backend

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Warning: .env file not found!" -ForegroundColor Yellow
    Write-Host "Please create a .env file with your GEMINI_API_KEY" -ForegroundColor Yellow
    Write-Host "Example: GEMINI_API_KEY=your_api_key_here" -ForegroundColor Cyan
}

# Start the server
Write-Host "🎯 Starting DeliverIt AI Backend on http://localhost:3001..." -ForegroundColor Green
Write-Host "📡 WebSocket server will be available on ws://localhost:3001" -ForegroundColor Blue
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

node server.js
