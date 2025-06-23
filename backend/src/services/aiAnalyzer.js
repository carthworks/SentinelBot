const logger = require('../utils/logger')

// Simulated AI vulnerability analyzer
// In production, this would integrate with OpenAI, Claude, or other LLM APIs

class AIVulnerabilityAnalyzer {
  constructor() {
    this.vulnerabilityDatabase = {
      // Common vulnerability patterns and their analysis
      'ssh_open': {
        risk_level: 'medium',
        base_cvss: 5.3,
        description: 'SSH service is exposed and accessible from external networks',
        fix_suggestions: [
          'Restrict SSH access to specific IP ranges using firewall rules',
          'Implement fail2ban to prevent brute force attacks',
          'Use key-based authentication instead of passwords',
          'Change SSH port from default 22 to a non-standard port',
          'Disable root login via SSH'
        ]
      },
      'http_server_outdated': {
        risk_level: 'high',
        base_cvss: 7.5,
        description: 'Web server is running an outdated version with known security vulnerabilities',
        fix_suggestions: [
          'Update web server to the latest stable version',
          'Apply all available security patches',
          'Review and harden server configuration',
          'Implement Web Application Firewall (WAF)',
          'Regular security updates and monitoring'
        ]
      },
      'ssl_weak_cipher': {
        risk_level: 'low',
        base_cvss: 3.7,
        description: 'Server supports weak SSL/TLS cipher suites that could be exploited',
        fix_suggestions: [
          'Disable weak cipher suites (RC4, DES, 3DES)',
          'Enable only strong encryption algorithms (AES)',
          'Use TLS 1.2 or higher versions only',
          'Implement Perfect Forward Secrecy (PFS)',
          'Regular SSL/TLS configuration audits'
        ]
      },
      'database_exposed': {
        risk_level: 'high',
        base_cvss: 8.1,
        description: 'Database service is accessible from external networks',
        fix_suggestions: [
          'Restrict database access to application servers only',
          'Use VPN for remote database administration',
          'Implement database firewall rules',
          'Enable database encryption at rest and in transit',
          'Regular database security audits'
        ]
      },
      'sql_injection': {
        risk_level: 'critical',
        base_cvss: 9.8,
        description: 'Application is vulnerable to SQL injection attacks',
        fix_suggestions: [
          'Use parameterized queries and prepared statements',
          'Implement input validation and sanitization',
          'Apply principle of least privilege for database users',
          'Use stored procedures where appropriate',
          'Regular code security reviews and testing'
        ]
      },
      'xss_vulnerability': {
        risk_level: 'medium',
        base_cvss: 6.1,
        description: 'Application is vulnerable to Cross-Site Scripting (XSS) attacks',
        fix_suggestions: [
          'Implement proper input validation and output encoding',
          'Use Content Security Policy (CSP) headers',
          'Sanitize user input before displaying',
          'Use secure coding practices for web development',
          'Regular security testing and code reviews'
        ]
      },
      'open_port': {
        risk_level: 'info',
        base_cvss: 0.0,
        description: 'Network service detected on open port',
        fix_suggestions: [
          'Review if this service is necessary',
          'Implement access controls if service is required',
          'Monitor service for security updates',
          'Consider using VPN for sensitive services'
        ]
      }
    }
  }

  async analyzeVulnerability(scanResult) {
    try {
      const analysis = this.performAnalysis(scanResult)
      
      // Simulate AI processing delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500))
      
      return analysis
    } catch (error) {
      logger.error('AI analysis failed:', error)
      return this.getFallbackAnalysis(scanResult)
    }
  }

  performAnalysis(scanResult) {
    const { vulnerability_type, title, description, port, service, raw_output } = scanResult
    
    // Determine vulnerability pattern
    const pattern = this.identifyVulnerabilityPattern(scanResult)
    const baseAnalysis = this.vulnerabilityDatabase[pattern] || this.vulnerabilityDatabase['open_port']
    
    // Calculate risk score based on context
    const contextualRisk = this.calculateContextualRisk(scanResult, baseAnalysis)
    
    // Generate detailed analysis
    const analysis = {
      risk_level: contextualRisk.risk_level,
      cvss_score: contextualRisk.cvss_score,
      title: this.generateTitle(scanResult, pattern),
      description: this.generateDescription(scanResult, baseAnalysis),
      fix_suggestion: this.generateFixSuggestion(scanResult, baseAnalysis),
      technical_details: this.extractTechnicalDetails(scanResult),
      impact_assessment: this.assessImpact(contextualRisk.risk_level),
      remediation_priority: this.calculateRemediationPriority(contextualRisk),
      references: this.getReferences(pattern),
      confidence_score: this.calculateConfidenceScore(scanResult)
    }
    
    return analysis
  }

  identifyVulnerabilityPattern(scanResult) {
    const { vulnerability_type, title, description, port, service } = scanResult
    
    // Pattern matching logic
    if (vulnerability_type?.toLowerCase().includes('sql') || 
        title?.toLowerCase().includes('sql injection')) {
      return 'sql_injection'
    }
    
    if (vulnerability_type?.toLowerCase().includes('xss') || 
        title?.toLowerCase().includes('cross-site scripting')) {
      return 'xss_vulnerability'
    }
    
    if (service === 'ssh' || port === 22) {
      return 'ssh_open'
    }
    
    if ((service === 'http' || service === 'https' || port === 80 || port === 443) &&
        (description?.toLowerCase().includes('outdated') || 
         description?.toLowerCase().includes('vulnerable version'))) {
      return 'http_server_outdated'
    }
    
    if (vulnerability_type?.toLowerCase().includes('ssl') || 
        vulnerability_type?.toLowerCase().includes('tls')) {
      return 'ssl_weak_cipher'
    }
    
    if (service === 'mysql' || service === 'postgresql' || service === 'mssql' ||
        port === 3306 || port === 5432 || port === 1433) {
      return 'database_exposed'
    }
    
    return 'open_port'
  }

  calculateContextualRisk(scanResult, baseAnalysis) {
    let riskMultiplier = 1.0
    let cvssScore = baseAnalysis.base_cvss
    
    // Adjust risk based on context
    if (scanResult.port && [22, 23, 3389].includes(scanResult.port)) {
      riskMultiplier += 0.2 // Remote access services are higher risk
    }
    
    if (scanResult.service && ['mysql', 'postgresql', 'mssql'].includes(scanResult.service)) {
      riskMultiplier += 0.3 // Database services are higher risk
    }
    
    if (scanResult.cve_id) {
      riskMultiplier += 0.4 // Known CVE increases risk
    }
    
    // Calculate final CVSS score
    cvssScore = Math.min(cvssScore * riskMultiplier, 10.0)
    
    // Determine risk level based on CVSS score
    let riskLevel = baseAnalysis.risk_level
    if (cvssScore >= 9.0) riskLevel = 'critical'
    else if (cvssScore >= 7.0) riskLevel = 'high'
    else if (cvssScore >= 4.0) riskLevel = 'medium'
    else if (cvssScore >= 0.1) riskLevel = 'low'
    else riskLevel = 'info'
    
    return {
      risk_level: riskLevel,
      cvss_score: Math.round(cvssScore * 10) / 10
    }
  }

  generateTitle(scanResult, pattern) {
    const baseTitle = scanResult.title || scanResult.vulnerability_type || 'Security Finding'
    
    if (pattern === 'ssh_open') {
      return `SSH Service Exposed on Port ${scanResult.port || 22}`
    }
    
    if (pattern === 'database_exposed') {
      return `Database Service Accessible from External Networks`
    }
    
    return baseTitle
  }

  generateDescription(scanResult, baseAnalysis) {
    let description = baseAnalysis.description
    
    if (scanResult.service) {
      description += ` The ${scanResult.service} service is running on port ${scanResult.port || 'unknown'}.`
    }
    
    if (scanResult.cve_id) {
      description += ` This finding is associated with ${scanResult.cve_id}.`
    }
    
    return description
  }

  generateFixSuggestion(scanResult, baseAnalysis) {
    const suggestions = [...baseAnalysis.fix_suggestions]
    
    // Add context-specific suggestions
    if (scanResult.port) {
      suggestions.push(`Consider changing the service from default port ${scanResult.port} if possible`)
    }
    
    return suggestions.join('\n• ')
  }

  extractTechnicalDetails(scanResult) {
    return {
      port: scanResult.port,
      service: scanResult.service,
      protocol: scanResult.protocol || 'tcp',
      banner: scanResult.banner,
      version: scanResult.version,
      raw_output: scanResult.raw_output
    }
  }

  assessImpact(riskLevel) {
    const impacts = {
      critical: 'Complete system compromise, data breach, or service disruption highly likely',
      high: 'Significant security risk with potential for unauthorized access or data exposure',
      medium: 'Moderate security risk that could lead to limited unauthorized access',
      low: 'Minor security concern with limited potential impact',
      info: 'Informational finding for security awareness'
    }
    
    return impacts[riskLevel] || impacts.info
  }

  calculateRemediationPriority(contextualRisk) {
    const priorities = {
      critical: 'Immediate (within 24 hours)',
      high: 'High (within 1 week)',
      medium: 'Medium (within 1 month)',
      low: 'Low (within 3 months)',
      info: 'Informational (as time permits)'
    }
    
    return priorities[contextualRisk.risk_level] || priorities.info
  }

  getReferences(pattern) {
    const references = {
      ssh_open: [
        'https://www.ssh.com/academy/ssh/security',
        'https://nvd.nist.gov/vuln/search/results?form_type=Basic&results_type=overview&query=SSH'
      ],
      sql_injection: [
        'https://owasp.org/www-community/attacks/SQL_Injection',
        'https://cwe.mitre.org/data/definitions/89.html'
      ],
      xss_vulnerability: [
        'https://owasp.org/www-community/attacks/xss/',
        'https://cwe.mitre.org/data/definitions/79.html'
      ]
    }
    
    return references[pattern] || []
  }

  calculateConfidenceScore(scanResult) {
    let confidence = 0.7 // Base confidence
    
    if (scanResult.cve_id) confidence += 0.2
    if (scanResult.service) confidence += 0.1
    if (scanResult.version) confidence += 0.1
    
    return Math.min(confidence, 1.0)
  }

  getFallbackAnalysis(scanResult) {
    return {
      risk_level: 'info',
      cvss_score: 0.0,
      title: scanResult.title || 'Security Finding',
      description: 'A security finding was detected but could not be fully analyzed.',
      fix_suggestion: 'Review this finding manually and apply appropriate security measures.',
      technical_details: scanResult,
      impact_assessment: 'Impact assessment unavailable',
      remediation_priority: 'Manual review required',
      references: [],
      confidence_score: 0.3
    }
  }
}

// Export singleton instance
const aiAnalyzer = new AIVulnerabilityAnalyzer()

module.exports = {
  analyzeVulnerability: (scanResult) => aiAnalyzer.analyzeVulnerability(scanResult),
  AIVulnerabilityAnalyzer
}
