# DeliverIt AI - Complete Setup Guide
# Created by Aditya Upadhyay

Write-Host "🚀 DeliverIt AI - Complete Setup" -ForegroundColor Green
Write-Host "👨‍💻 Created by: Aditya Upadhyay" -ForegroundColor Cyan
Write-Host "🏢 Company: DeliverIt (Founded by Sidhant Suri, CTO: Kunal Aashri)" -ForegroundColor Yellow
Write-Host ""

Write-Host "📋 Setup Instructions:" -ForegroundColor White
Write-Host "1. First, copy your Gemini API key to backend\.env" -ForegroundColor Cyan
Write-Host "2. Start the backend server: .\start-backend.ps1" -ForegroundColor Cyan
Write-Host "3. In a new terminal, start the frontend: .\start-frontend.ps1" -ForegroundColor Cyan
Write-Host ""

Write-Host "🔧 Current Setup Status:" -ForegroundColor White

# Check backend setup
if (Test-Path "backend\package.json") {
    Write-Host "✅ Backend package.json exists" -ForegroundColor Green
} else {
    Write-Host "❌ Backend package.json missing" -ForegroundColor Red
}

if (Test-Path "backend\server.js") {
    Write-Host "✅ Backend server.js exists" -ForegroundColor Green
} else {
    Write-Host "❌ Backend server.js missing" -ForegroundColor Red
}

if (Test-Path "backend\.env") {
    Write-Host "✅ Backend .env file exists" -ForegroundColor Green
} else {
    Write-Host "⚠️  Backend .env file missing - you need to create this!" -ForegroundColor Yellow
}

if (Test-Path "backend\node_modules") {
    Write-Host "✅ Backend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Backend dependencies not installed yet" -ForegroundColor Yellow
}

# Check frontend setup
if (Test-Path "package.json") {
    Write-Host "✅ Frontend package.json exists" -ForegroundColor Green
} else {
    Write-Host "❌ Frontend package.json missing" -ForegroundColor Red
}

if (Test-Path "index-backend.tsx") {
    Write-Host "✅ Backend-enabled frontend exists" -ForegroundColor Green
} else {
    Write-Host "❌ Backend-enabled frontend missing" -ForegroundColor Red
}

if (Test-Path "node_modules") {
    Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Frontend dependencies not installed yet" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔑 Next Steps:" -ForegroundColor White

if (-not (Test-Path "backend\.env")) {
    Write-Host "1. Create backend\.env file with your Gemini API key:" -ForegroundColor Yellow
    Write-Host "   GEMINI_API_KEY=your_api_key_here" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "2. Start backend server: .\start-backend.ps1" -ForegroundColor Cyan
Write-Host "3. Start frontend server: .\start-frontend.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌟 Your DeliverIt AI Assistant will be ready!" -ForegroundColor Green
Write-Host "💡 Backend API: http://localhost:3001" -ForegroundColor Blue
Write-Host "💡 Frontend App: http://localhost:5173" -ForegroundColor Blue
