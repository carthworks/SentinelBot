# 🛡️ Security Tools Installation Guide

## Overview
SentinelBot integrates with popular security tools to perform comprehensive penetration testing. Here's how to install and configure each tool.

## 🔧 Tool Installation

### 1. Nmap (Network Scanner)

**Windows Installation:**
1. Download from: https://nmap.org/download.html
2. Run the installer with default settings
3. Add to PATH: `C:\Program Files (x86)\Nmap`
4. Test: Open Command Prompt and run `nmap --version`

**Alternative (Chocolatey):**
```powershell
# Run as Administrator
choco install nmap
```

### 2. Python (Required for some tools)

**Windows Installation:**
1. Download from: https://www.python.org/downloads/
2. **IMPORTANT**: Check "Add Python to PATH" during installation
3. Test: `python --version`

**Alternative (Chocolatey):**
```powershell
choco install python
```

### 3. Nikto (Web Scanner)

**Manual Installation:**
1. Download from: https://github.com/sullo/nikto/archive/master.zip
2. Extract to `C:\Tools\nikto`
3. Install Perl: https://strawberryperl.com/
4. Create batch file `C:\Tools\nikto.bat`:
   ```batch
   @echo off
   perl "C:\Tools\nikto\program\nikto.pl" %*
   ```
5. Add `C:\Tools` to PATH

**Git Installation:**
```bash
git clone https://github.com/sullo/nikto.git C:\Tools\nikto
```

### 4. SQLMap (SQL Injection Tool)

**Python Installation (Recommended):**
```bash
pip install sqlmap
```

**Manual Installation:**
1. Download from: https://github.com/sqlmapproject/sqlmap/archive/master.zip
2. Extract to `C:\Tools\sqlmap`
3. Create batch file `C:\Tools\sqlmap.bat`:
   ```batch
   @echo off
   python "C:\Tools\sqlmap\sqlmap.py" %*
   ```

### 5. OWASP ZAP (Web Application Scanner)

**Manual Installation:**
1. Download from: https://www.zaproxy.org/download/
2. Install the Windows installer
3. Default location: `C:\Program Files\ZAP\Zed Attack Proxy`

**Chocolatey Installation:**
```powershell
choco install zap
```

## 🔧 Configuration

### Update .env File

After installing the tools, update your `.env` file with the correct paths:

```bash
# Security Tools Paths
NMAP_PATH=C:\Program Files (x86)\Nmap\nmap.exe
NIKTO_PATH=C:\Tools\nikto.bat
SQLMAP_PATH=sqlmap
ZAP_PATH=C:\Program Files\ZAP\Zed Attack Proxy\zap.bat

# Alternative paths if installed via Chocolatey
# NMAP_PATH=nmap
# NIKTO_PATH=nikto
# SQLMAP_PATH=sqlmap
# ZAP_PATH=zap.sh
```

## 🧪 Testing Installation

Create a test script to verify all tools are working:

```javascript
// test-tools.js
const { spawn } = require('child_process');

async function testTool(command, args = ['--version']) {
  return new Promise((resolve) => {
    const process = spawn(command, args);
    process.on('close', (code) => {
      resolve(code === 0);
    });
    process.on('error', () => {
      resolve(false);
    });
  });
}

async function testAllTools() {
  console.log('🧪 Testing Security Tools Installation...\n');
  
  const tools = [
    { name: 'Nmap', command: 'nmap', args: ['--version'] },
    { name: 'Python', command: 'python', args: ['--version'] },
    { name: 'SQLMap', command: 'sqlmap', args: ['--version'] },
    { name: 'Nikto', command: 'nikto', args: ['-Version'] }
  ];
  
  for (const tool of tools) {
    const isWorking = await testTool(tool.command, tool.args);
    console.log(`${tool.name}: ${isWorking ? '✅ Working' : '❌ Not found'}`);
  }
}

testAllTools();
```

Run the test:
```bash
node test-tools.js
```

## 🐳 Docker Alternative (Recommended)

If you prefer to use Docker for the security tools:

```dockerfile
# Create Dockerfile for security tools
FROM kalilinux/kali-rolling

RUN apt-get update && apt-get install -y \
    nmap \
    nikto \
    sqlmap \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install OWASP ZAP
RUN wget -q https://github.com/zaproxy/zaproxy/releases/download/v2.14.0/ZAP_2.14.0_Linux.tar.gz \
    && tar -xzf ZAP_2.14.0_Linux.tar.gz -C /opt/ \
    && ln -sf /opt/ZAP_2.14.0/zap.sh /usr/local/bin/zap.sh

WORKDIR /app
CMD ["bash"]
```

Build and use:
```bash
docker build -t sentinelbot-tools .
docker run -it --rm sentinelbot-tools nmap --version
```

## 🔍 Tool Usage Examples

### Nmap Examples
```bash
# Basic port scan
nmap -T4 -A example.com

# Vulnerability scan
nmap --script vuln example.com

# Service detection
nmap -sV example.com
```

### Nikto Examples
```bash
# Basic web scan
nikto -h http://example.com

# Scan with specific port
nikto -h http://example.com -port 8080
```

### SQLMap Examples
```bash
# Test URL for SQL injection
sqlmap -u "http://example.com/page?id=1" --batch

# Test with POST data
sqlmap -u "http://example.com/login" --data "user=admin&pass=admin" --batch
```

## 🚨 Important Notes

1. **Legal Usage**: Only use these tools on systems you own or have explicit permission to test
2. **Firewall**: Some tools may be blocked by Windows Defender or firewall
3. **Antivirus**: Security tools are often flagged as potentially unwanted programs
4. **Performance**: Running multiple scans simultaneously can impact system performance
5. **Network**: Some scans generate significant network traffic

## 🔧 Troubleshooting

### Common Issues:

1. **"Command not found"**
   - Check if tool is installed
   - Verify PATH environment variable
   - Try full path to executable

2. **"Permission denied"**
   - Run Command Prompt as Administrator
   - Check file permissions

3. **"Python not found"**
   - Reinstall Python with "Add to PATH" option
   - Restart Command Prompt after installation

4. **Antivirus blocking tools**
   - Add tools directory to antivirus exclusions
   - Temporarily disable real-time protection during installation

### Getting Help:

- Check tool documentation
- Verify installation paths in .env file
- Test tools individually before using with SentinelBot
- Check Windows Event Viewer for detailed error messages

## 📚 Additional Resources

- [Nmap Documentation](https://nmap.org/docs.html)
- [Nikto Documentation](https://github.com/sullo/nikto/wiki)
- [SQLMap Documentation](https://github.com/sqlmapproject/sqlmap/wiki)
- [OWASP ZAP Documentation](https://www.zaproxy.org/docs/)
