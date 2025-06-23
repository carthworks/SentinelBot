# SentinelBot Windows Setup Script
Write-Host "🛡️  SentinelBot Windows Setup" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# Check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (!(Test-Administrator)) {
    Write-Host "⚠️  This script requires administrator privileges!" -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Running with administrator privileges" -ForegroundColor Green

# Install Chocolatey if not present
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing Chocolatey package manager..." -ForegroundColor Blue
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    Write-Host "✅ Chocolatey installed" -ForegroundColor Green
} else {
    Write-Host "✅ Chocolatey already installed" -ForegroundColor Green
}

# Install PostgreSQL
Write-Host "🗄️  Installing PostgreSQL..." -ForegroundColor Blue
if (!(Get-Command psql -ErrorAction SilentlyContinue)) {
    choco install postgresql -y --params '/Password:postgres'
    Write-Host "✅ PostgreSQL installed with password 'postgres'" -ForegroundColor Green
} else {
    Write-Host "✅ PostgreSQL already installed" -ForegroundColor Green
}

# Install Redis
Write-Host "🔴 Installing Redis..." -ForegroundColor Blue
if (!(Get-Command redis-server -ErrorAction SilentlyContinue)) {
    choco install redis-64 -y
    Write-Host "✅ Redis installed" -ForegroundColor Green
} else {
    Write-Host "✅ Redis already installed" -ForegroundColor Green
}

# Install Python
Write-Host "🐍 Installing Python..." -ForegroundColor Blue
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    choco install python -y
    Write-Host "✅ Python installed" -ForegroundColor Green
} else {
    Write-Host "✅ Python already installed" -ForegroundColor Green
}

# Install Git
Write-Host "📁 Installing Git..." -ForegroundColor Blue
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    choco install git -y
    Write-Host "✅ Git installed" -ForegroundColor Green
} else {
    Write-Host "✅ Git already installed" -ForegroundColor Green
}

# Install Nmap
Write-Host "🔍 Installing Nmap..." -ForegroundColor Blue
if (!(Get-Command nmap -ErrorAction SilentlyContinue)) {
    choco install nmap -y
    Write-Host "✅ Nmap installed" -ForegroundColor Green
} else {
    Write-Host "✅ Nmap already installed" -ForegroundColor Green
}

# Refresh environment variables
Write-Host "🔄 Refreshing environment variables..." -ForegroundColor Blue
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Start services
Write-Host "🚀 Starting services..." -ForegroundColor Blue

# Start PostgreSQL service
try {
    Start-Service postgresql*
    Write-Host "✅ PostgreSQL service started" -ForegroundColor Green
} catch {
    Write-Host "⚠️  PostgreSQL service may already be running" -ForegroundColor Yellow
}

# Start Redis service
try {
    Start-Service redis
    Write-Host "✅ Redis service started" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Redis service may already be running" -ForegroundColor Yellow
}

# Create database
Write-Host "🗄️  Setting up SentinelBot database..." -ForegroundColor Blue
$env:PGPASSWORD = "postgres"

# Create database and user
$sqlCommands = @"
CREATE DATABASE sentinelbot;
CREATE USER sentinelbot WITH PASSWORD 'sentinelbot123';
GRANT ALL PRIVILEGES ON DATABASE sentinelbot TO sentinelbot;
"@

try {
    $sqlCommands | psql -U postgres -d postgres
    Write-Host "✅ Database created successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Database may already exist" -ForegroundColor Yellow
}

# Install Python packages
Write-Host "📦 Installing Python security tools..." -ForegroundColor Blue
try {
    pip install sqlmap
    Write-Host "✅ SQLMap installed via pip" -ForegroundColor Green
} catch {
    Write-Host "⚠️  SQLMap installation failed" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Windows setup completed!" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Navigate to backend directory: cd backend" -ForegroundColor White
Write-Host "2. Run database migration: npm run migrate" -ForegroundColor White
Write-Host "3. Test setup: npm run test-setup" -ForegroundColor White
Write-Host "4. Start backend: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "🔐 Default credentials:" -ForegroundColor Cyan
Write-Host "PostgreSQL: postgres/postgres" -ForegroundColor White
Write-Host "SentinelBot: admin@sentinelbot.com/admin123" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  You may need to restart your terminal for PATH changes to take effect" -ForegroundColor Yellow
