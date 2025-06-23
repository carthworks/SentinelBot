#!/bin/bash

# SentinelBot Security Tools Installation Script
# This script installs Nmap, Nikto, SQLMap, and OWASP ZAP

set -e

echo "🛡️  Installing Security Tools for SentinelBot"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/debian_version ]; then
            OS="debian"
        elif [ -f /etc/redhat-release ]; then
            OS="redhat"
        else
            OS="linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        OS="windows"
    else
        OS="unknown"
    fi
    
    print_status "Detected OS: $OS"
}

# Install Nmap
install_nmap() {
    print_status "Installing Nmap..."
    
    case $OS in
        "debian")
            sudo apt-get update
            sudo apt-get install -y nmap
            ;;
        "redhat")
            sudo yum install -y nmap
            ;;
        "macos")
            if command -v brew &> /dev/null; then
                brew install nmap
            else
                print_error "Homebrew not found. Please install from: https://nmap.org/download.html"
                return 1
            fi
            ;;
        "windows")
            print_warning "Please download Nmap from: https://nmap.org/download.html"
            print_warning "Add nmap.exe to your PATH or update NMAP_PATH in .env"
            return 0
            ;;
        *)
            print_error "Unsupported OS for automatic installation"
            return 1
            ;;
    esac
    
    if command -v nmap &> /dev/null; then
        NMAP_VERSION=$(nmap --version | head -n1)
        print_success "Nmap installed: $NMAP_VERSION"
    else
        print_error "Nmap installation failed"
        return 1
    fi
}

# Install Nikto
install_nikto() {
    print_status "Installing Nikto..."
    
    case $OS in
        "debian")
            sudo apt-get install -y nikto
            ;;
        "redhat")
            sudo yum install -y nikto
            ;;
        "macos")
            if command -v brew &> /dev/null; then
                brew install nikto
            else
                print_warning "Installing Nikto via Git..."
                git clone https://github.com/sullo/nikto.git /tmp/nikto
                sudo cp -r /tmp/nikto/program /usr/local/nikto
                sudo ln -sf /usr/local/nikto/nikto.pl /usr/local/bin/nikto
            fi
            ;;
        "windows")
            print_warning "Please download Nikto from: https://github.com/sullo/nikto"
            print_warning "Or use WSL for Linux tools"
            return 0
            ;;
        *)
            print_warning "Installing Nikto via Git..."
            git clone https://github.com/sullo/nikto.git /tmp/nikto
            sudo cp -r /tmp/nikto/program /usr/local/nikto
            sudo ln -sf /usr/local/nikto/nikto.pl /usr/local/bin/nikto
            ;;
    esac
    
    if command -v nikto &> /dev/null; then
        print_success "Nikto installed successfully"
    else
        print_error "Nikto installation failed"
        return 1
    fi
}

# Install SQLMap
install_sqlmap() {
    print_status "Installing SQLMap..."
    
    case $OS in
        "debian")
            sudo apt-get install -y sqlmap
            ;;
        "redhat")
            sudo yum install -y sqlmap
            ;;
        "macos")
            if command -v brew &> /dev/null; then
                brew install sqlmap
            else
                print_warning "Installing SQLMap via Git..."
                git clone --depth 1 https://github.com/sqlmapproject/sqlmap.git /tmp/sqlmap
                sudo cp -r /tmp/sqlmap /usr/local/sqlmap
                sudo ln -sf /usr/local/sqlmap/sqlmap.py /usr/local/bin/sqlmap
            fi
            ;;
        "windows")
            print_warning "Please download SQLMap from: https://github.com/sqlmapproject/sqlmap"
            print_warning "Or use: pip install sqlmap"
            return 0
            ;;
        *)
            print_warning "Installing SQLMap via Git..."
            git clone --depth 1 https://github.com/sqlmapproject/sqlmap.git /tmp/sqlmap
            sudo cp -r /tmp/sqlmap /usr/local/sqlmap
            sudo ln -sf /usr/local/sqlmap/sqlmap.py /usr/local/bin/sqlmap
            ;;
    esac
    
    if command -v sqlmap &> /dev/null; then
        print_success "SQLMap installed successfully"
    else
        print_error "SQLMap installation failed"
        return 1
    fi
}

# Install OWASP ZAP
install_zap() {
    print_status "Installing OWASP ZAP..."
    
    case $OS in
        "debian")
            # Download and install ZAP
            ZAP_VERSION="2.14.0"
            wget -q "https://github.com/zaproxy/zaproxy/releases/download/v${ZAP_VERSION}/ZAP_${ZAP_VERSION}_Linux.tar.gz" -O /tmp/zap.tar.gz
            sudo tar -xzf /tmp/zap.tar.gz -C /opt/
            sudo ln -sf /opt/ZAP_${ZAP_VERSION}/zap.sh /usr/local/bin/zap.sh
            ;;
        "macos")
            if command -v brew &> /dev/null; then
                brew install --cask owasp-zap
            else
                print_warning "Please download OWASP ZAP from: https://www.zaproxy.org/download/"
            fi
            ;;
        "windows")
            print_warning "Please download OWASP ZAP from: https://www.zaproxy.org/download/"
            return 0
            ;;
        *)
            print_warning "Please download OWASP ZAP from: https://www.zaproxy.org/download/"
            return 0
            ;;
    esac
    
    print_success "OWASP ZAP installation completed"
}

# Update environment file with tool paths
update_env_paths() {
    print_status "Updating environment file with tool paths..."
    
    ENV_FILE="../.env"
    if [ ! -f "$ENV_FILE" ]; then
        ENV_FILE=".env"
    fi
    
    if [ -f "$ENV_FILE" ]; then
        # Update tool paths
        if command -v nmap &> /dev/null; then
            NMAP_PATH=$(which nmap)
            sed -i "s|NMAP_PATH=.*|NMAP_PATH=$NMAP_PATH|g" "$ENV_FILE"
        fi
        
        if command -v nikto &> /dev/null; then
            NIKTO_PATH=$(which nikto)
            sed -i "s|NIKTO_PATH=.*|NIKTO_PATH=$NIKTO_PATH|g" "$ENV_FILE"
        fi
        
        if command -v sqlmap &> /dev/null; then
            SQLMAP_PATH=$(which sqlmap)
            sed -i "s|SQLMAP_PATH=.*|SQLMAP_PATH=$SQLMAP_PATH|g" "$ENV_FILE"
        fi
        
        print_success "Environment file updated with tool paths"
    else
        print_warning "Environment file not found"
    fi
}

# Test installations
test_tools() {
    print_status "Testing tool installations..."
    
    echo "Testing Nmap..."
    if nmap --version > /dev/null 2>&1; then
        print_success "✓ Nmap is working"
    else
        print_error "✗ Nmap test failed"
    fi
    
    echo "Testing Nikto..."
    if nikto -Version > /dev/null 2>&1; then
        print_success "✓ Nikto is working"
    else
        print_error "✗ Nikto test failed"
    fi
    
    echo "Testing SQLMap..."
    if sqlmap --version > /dev/null 2>&1; then
        print_success "✓ SQLMap is working"
    else
        print_error "✗ SQLMap test failed"
    fi
}

# Main installation function
main() {
    detect_os
    
    echo ""
    echo "This script will install the following security tools:"
    echo "1. Nmap - Network discovery and security auditing"
    echo "2. Nikto - Web server scanner"
    echo "3. SQLMap - SQL injection testing tool"
    echo "4. OWASP ZAP - Web application security scanner"
    echo ""
    
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    
    # Install tools
    install_nmap
    install_nikto
    install_sqlmap
    install_zap
    
    # Update environment
    update_env_paths
    
    # Test installations
    test_tools
    
    echo ""
    print_success "Security tools installation completed!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Update .env file with correct tool paths if needed"
    echo "2. Test the tools manually to ensure they work"
    echo "3. Start the SentinelBot backend server"
    echo ""
}

# Run main function
main "$@"
