# SentinelBot Security Tools Installation Script for Windows
# This script helps install security tools on Windows

Write-Host "🛡️  SentinelBot Security Tools Setup for Windows" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

function Write-Status {
    param($Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param($Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param($Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param($Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Install Chocolatey if not present
function Install-Chocolatey {
    if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Status "Installing Chocolatey package manager..."
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        Write-Success "Chocolatey installed successfully"
    } else {
        Write-Success "Chocolatey is already installed"
    }
}

# Install Python if not present
function Install-Python {
    if (!(Get-Command python -ErrorAction SilentlyContinue)) {
        Write-Status "Installing Python..."
        choco install python -y
        Write-Success "Python installed successfully"
        # Refresh environment variables
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    } else {
        Write-Success "Python is already installed"
    }
}

# Install Git if not present
function Install-Git {
    if (!(Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Status "Installing Git..."
        choco install git -y
        Write-Success "Git installed successfully"
    } else {
        Write-Success "Git is already installed"
    }
}

# Install Nmap
function Install-Nmap {
    Write-Status "Installing Nmap..."
    
    if (Get-Command nmap -ErrorAction SilentlyContinue) {
        Write-Success "Nmap is already installed"
        return
    }
    
    try {
        choco install nmap -y
        Write-Success "Nmap installed successfully"
        
        # Add to PATH if not already there
        $nmapPath = "C:\Program Files (x86)\Nmap"
        if (Test-Path $nmapPath) {
            $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
            if ($currentPath -notlike "*$nmapPath*") {
                [Environment]::SetEnvironmentVariable("Path", "$currentPath;$nmapPath", "User")
                Write-Success "Added Nmap to PATH"
            }
        }
    } catch {
        Write-Error "Failed to install Nmap: $($_.Exception.Message)"
        Write-Warning "Please download manually from: https://nmap.org/download.html"
    }
}

# Install Nikto
function Install-Nikto {
    Write-Status "Installing Nikto..."
    
    try {
        # Install via Git
        $niktoPath = "C:\Tools\nikto"
        if (!(Test-Path $niktoPath)) {
            New-Item -ItemType Directory -Path "C:\Tools" -Force | Out-Null
            git clone https://github.com/sullo/nikto.git $niktoPath
            Write-Success "Nikto cloned successfully"
        } else {
            Write-Success "Nikto is already installed"
        }
        
        # Create batch file for easy execution
        $batchContent = "@echo off`nperl `"$niktoPath\program\nikto.pl`" %*"
        $batchPath = "C:\Tools\nikto.bat"
        $batchContent | Out-File -FilePath $batchPath -Encoding ASCII
        
        # Add to PATH
        $toolsPath = "C:\Tools"
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($currentPath -notlike "*$toolsPath*") {
            [Environment]::SetEnvironmentVariable("Path", "$currentPath;$toolsPath", "User")
            Write-Success "Added Nikto to PATH"
        }
        
    } catch {
        Write-Error "Failed to install Nikto: $($_.Exception.Message)"
        Write-Warning "Please install manually from: https://github.com/sullo/nikto"
    }
}

# Install SQLMap
function Install-SQLMap {
    Write-Status "Installing SQLMap..."
    
    try {
        # Install via pip
        pip install sqlmap
        Write-Success "SQLMap installed via pip"
    } catch {
        Write-Warning "Failed to install via pip, trying Git..."
        try {
            $sqlmapPath = "C:\Tools\sqlmap"
            if (!(Test-Path $sqlmapPath)) {
                git clone https://github.com/sqlmapproject/sqlmap.git $sqlmapPath
                Write-Success "SQLMap cloned successfully"
            } else {
                Write-Success "SQLMap is already installed"
            }
            
            # Create batch file
            $batchContent = "@echo off`npython `"$sqlmapPath\sqlmap.py`" %*"
            $batchPath = "C:\Tools\sqlmap.bat"
            $batchContent | Out-File -FilePath $batchPath -Encoding ASCII
            
        } catch {
            Write-Error "Failed to install SQLMap: $($_.Exception.Message)"
            Write-Warning "Please install manually from: https://github.com/sqlmapproject/sqlmap"
        }
    }
}

# Install OWASP ZAP
function Install-ZAP {
    Write-Status "Installing OWASP ZAP..."
    
    try {
        choco install zap -y
        Write-Success "OWASP ZAP installed successfully"
    } catch {
        Write-Error "Failed to install OWASP ZAP via Chocolatey"
        Write-Warning "Please download manually from: https://www.zaproxy.org/download/"
        Write-Warning "Or try: winget install ZAP.ZAP"
    }
}

# Update environment file
function Update-EnvFile {
    Write-Status "Updating .env file with tool paths..."
    
    $envFile = "..\\.env"
    if (!(Test-Path $envFile)) {
        $envFile = ".env"
    }
    
    if (Test-Path $envFile) {
        $content = Get-Content $envFile
        
        # Update Nmap path
        if (Get-Command nmap -ErrorAction SilentlyContinue) {
            $nmapPath = (Get-Command nmap).Source
            $content = $content -replace "NMAP_PATH=.*", "NMAP_PATH=$nmapPath"
        }
        
        # Update Nikto path
        if (Test-Path "C:\Tools\nikto.bat") {
            $content = $content -replace "NIKTO_PATH=.*", "NIKTO_PATH=C:\\Tools\\nikto.bat"
        }
        
        # Update SQLMap path
        if (Get-Command sqlmap -ErrorAction SilentlyContinue) {
            $sqlmapPath = (Get-Command sqlmap).Source
            $content = $content -replace "SQLMAP_PATH=.*", "SQLMAP_PATH=$sqlmapPath"
        } elseif (Test-Path "C:\Tools\sqlmap.bat") {
            $content = $content -replace "SQLMAP_PATH=.*", "SQLMAP_PATH=C:\\Tools\\sqlmap.bat"
        }
        
        $content | Set-Content $envFile
        Write-Success "Environment file updated"
    } else {
        Write-Warning "Environment file not found"
    }
}

# Test installations
function Test-Tools {
    Write-Status "Testing tool installations..."
    
    Write-Host "Testing Nmap..." -NoNewline
    try {
        $null = nmap --version 2>$null
        Write-Host " ✓" -ForegroundColor Green
    } catch {
        Write-Host " ✗" -ForegroundColor Red
    }
    
    Write-Host "Testing Python..." -NoNewline
    try {
        $null = python --version 2>$null
        Write-Host " ✓" -ForegroundColor Green
    } catch {
        Write-Host " ✗" -ForegroundColor Red
    }
    
    Write-Host "Testing SQLMap..." -NoNewline
    try {
        $null = sqlmap --version 2>$null
        Write-Host " ✓" -ForegroundColor Green
    } catch {
        Write-Host " ✗" -ForegroundColor Red
    }
}

# Main function
function Main {
    Write-Host ""
    Write-Host "This script will install the following security tools:" -ForegroundColor Yellow
    Write-Host "1. Chocolatey (package manager)" -ForegroundColor White
    Write-Host "2. Python (required for some tools)" -ForegroundColor White
    Write-Host "3. Git (for cloning repositories)" -ForegroundColor White
    Write-Host "4. Nmap (network scanner)" -ForegroundColor White
    Write-Host "5. Nikto (web scanner)" -ForegroundColor White
    Write-Host "6. SQLMap (SQL injection tool)" -ForegroundColor White
    Write-Host "7. OWASP ZAP (web application scanner)" -ForegroundColor White
    Write-Host ""
    
    if (!(Test-Administrator)) {
        Write-Error "This script requires administrator privileges!"
        Write-Warning "Please run PowerShell as Administrator and try again."
        exit 1
    }
    
    $response = Read-Host "Do you want to continue? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "Installation cancelled." -ForegroundColor Yellow
        exit 0
    }
    
    # Install prerequisites
    Install-Chocolatey
    Install-Python
    Install-Git
    
    # Install security tools
    Install-Nmap
    Install-Nikto
    Install-SQLMap
    Install-ZAP
    
    # Update environment
    Update-EnvFile
    
    # Test installations
    Test-Tools
    
    Write-Host ""
    Write-Success "Security tools installation completed!"
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Cyan
    Write-Host "1. Restart your terminal to refresh PATH variables" -ForegroundColor White
    Write-Host "2. Test the tools manually to ensure they work" -ForegroundColor White
    Write-Host "3. Update .env file with correct tool paths if needed" -ForegroundColor White
    Write-Host "4. Start the SentinelBot backend server" -ForegroundColor White
    Write-Host ""
}

# Run main function
Main
