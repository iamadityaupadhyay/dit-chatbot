# DeliverIt AI - Start Frontend Development Server
# Created by Aditya Upadhyay

Write-Host "🚀 Starting DeliverIt AI Frontend..." -ForegroundColor Green
Write-Host "👨‍💻 Created by: Aditya Upadhyay" -ForegroundColor Cyan
Write-Host "🏢 Company: DeliverIt" -ForegroundColor Yellow

# Check if package.json exists
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found in current directory" -ForegroundColor Red
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Rename the current index.tsx to index-original.tsx if it exists
if (Test-Path "index.tsx") {
    if (-not (Test-Path "index-original.tsx")) {
        Write-Host "📁 Backing up original index.tsx..." -ForegroundColor Yellow
        Rename-Item "index.tsx" "index-original.tsx"
    }
}

# Copy the backend-enabled version to index.tsx
if (Test-Path "index-backend.tsx") {
    Write-Host "🔄 Using backend-enabled frontend..." -ForegroundColor Yellow
    Copy-Item "index-backend.tsx" "index.tsx" -Force
}

Write-Host "🌐 Starting frontend development server..." -ForegroundColor Green
Write-Host "Frontend will be available at: http://localhost:5173" -ForegroundColor Blue
Write-Host "Make sure the backend server is running on http://localhost:3001" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

npm run dev
