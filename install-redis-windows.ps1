# Install Redis for Windows
Write-Host "🔴 Installing Redis for Windows..." -ForegroundColor Cyan

# Check if Chocolatey is installed
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Chocolatey first..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
}

# Install Redis
Write-Host "Installing Redis..." -ForegroundColor Green
choco install redis-64 -y

# Start Redis service
Write-Host "Starting Redis service..." -ForegroundColor Green
Start-Service redis

# Test Redis
Write-Host "Testing Redis connection..." -ForegroundColor Blue
redis-cli ping

Write-Host "✅ Redis installation completed!" -ForegroundColor Green
Write-Host "Redis is running on localhost:6379" -ForegroundColor White
