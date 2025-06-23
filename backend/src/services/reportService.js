const PDFDocument = require('pdf-lib').PDFDocument
const fs = require('fs').promises
const path = require('path')
const logger = require('../utils/logger')

class ReportService {
  async generatePDFReport(scan, scanResults) {
    try {
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create()
      
      // Add metadata
      pdfDoc.setTitle(`SentinelBot Security Report - ${scan.target}`)
      pdfDoc.setAuthor('SentinelBot')
      pdfDoc.setSubject('Cybersecurity Penetration Test Report')
      pdfDoc.setCreator('SentinelBot Platform')
      pdfDoc.setProducer('SentinelBot Report Generator')
      pdfDoc.setCreationDate(new Date())
      
      // For now, create a simple text-based PDF
      // In production, you would use a proper PDF generation library like PDFKit
      const page = pdfDoc.addPage([612, 792]) // Letter size
      
      // This is a simplified implementation
      // In production, you would format the PDF properly with tables, charts, etc.
      const reportContent = this.generateReportContent(scan, scanResults)
      
      // Convert to buffer (simplified - in production use proper PDF generation)
      const pdfBytes = await pdfDoc.save()
      
      return Buffer.from(pdfBytes)
    } catch (error) {
      logger.error('PDF generation failed:', error)
      throw new Error('Failed to generate PDF report')
    }
  }

  async generateCSVReport(scan, scanResults) {
    try {
      const headers = [
        'Vulnerability Type',
        'Risk Level',
        'Title',
        'Description',
        'Fix Suggestion',
        'CVSS Score',
        'CVE ID',
        'Affected Component',
        'Port',
        'Service',
        'Date Found'
      ]

      let csvContent = headers.join(',') + '\n'

      for (const result of scanResults) {
        const row = [
          this.escapeCsvField(result.vulnerability_type || ''),
          this.escapeCsvField(result.risk_level || ''),
          this.escapeCsvField(result.title || ''),
          this.escapeCsvField(result.description || ''),
          this.escapeCsvField(result.fix_suggestion || ''),
          result.cvss_score || '',
          this.escapeCsvField(result.cve_id || ''),
          this.escapeCsvField(result.affected_component || ''),
          result.port || '',
          this.escapeCsvField(result.service || ''),
          result.created_at ? new Date(result.created_at).toISOString() : ''
        ]
        
        csvContent += row.join(',') + '\n'
      }

      return csvContent
    } catch (error) {
      logger.error('CSV generation failed:', error)
      throw new Error('Failed to generate CSV report')
    }
  }

  generateJSONReport(scan, scanResults) {
    try {
      const report = {
        metadata: {
          report_type: 'SentinelBot Security Assessment',
          generated_at: new Date().toISOString(),
          generator: 'SentinelBot Platform v1.0.0',
          scan_id: scan.id,
          target: scan.target,
          scan_type: scan.scan_type,
          scan_started: scan.started_at,
          scan_completed: scan.completed_at,
          scan_duration: scan.completed_at && scan.started_at 
            ? Math.round((new Date(scan.completed_at) - new Date(scan.started_at)) / 1000)
            : null
        },
        executive_summary: this.generateExecutiveSummary(scanResults),
        vulnerability_summary: this.generateVulnerabilitySummary(scanResults),
        detailed_findings: scanResults.map(result => ({
          id: result.id,
          vulnerability_type: result.vulnerability_type,
          risk_level: result.risk_level,
          title: result.title,
          description: result.description,
          fix_suggestion: result.fix_suggestion,
          cvss_score: result.cvss_score,
          cve_id: result.cve_id,
          affected_component: result.affected_component,
          port: result.port,
          service: result.service,
          technical_details: result.raw_output,
          ai_analysis: result.ai_analysis,
          discovered_at: result.created_at
        })),
        recommendations: this.generateRecommendations(scanResults),
        appendix: {
          scan_configuration: scan.scan_options,
          tools_used: this.getToolsUsed(scan.scan_type),
          methodology: this.getMethodology(scan.scan_type)
        }
      }

      return report
    } catch (error) {
      logger.error('JSON report generation failed:', error)
      throw new Error('Failed to generate JSON report')
    }
  }

  generateReportContent(scan, scanResults) {
    const summary = this.generateVulnerabilitySummary(scanResults)
    
    return `
SENTINELBOT SECURITY ASSESSMENT REPORT

Target: ${scan.target}
Scan Type: ${scan.scan_type}
Scan Date: ${scan.created_at}
Report Generated: ${new Date().toISOString()}

EXECUTIVE SUMMARY
=================
This report contains the results of an automated security assessment performed on ${scan.target}.
Total vulnerabilities found: ${scanResults.length}

VULNERABILITY SUMMARY
====================
Critical: ${summary.critical}
High: ${summary.high}
Medium: ${summary.medium}
Low: ${summary.low}
Informational: ${summary.info}

DETAILED FINDINGS
================
${scanResults.map((result, index) => `
${index + 1}. ${result.title}
   Risk Level: ${result.risk_level.toUpperCase()}
   CVSS Score: ${result.cvss_score || 'N/A'}
   Description: ${result.description}
   Fix Suggestion: ${result.fix_suggestion}
   ${result.cve_id ? `CVE: ${result.cve_id}` : ''}
   ${result.port ? `Port: ${result.port}` : ''}
   ${result.service ? `Service: ${result.service}` : ''}
`).join('\n')}

RECOMMENDATIONS
===============
${this.generateRecommendations(scanResults).map(rec => `• ${rec}`).join('\n')}

---
Generated by SentinelBot Platform
`
  }

  generateExecutiveSummary(scanResults) {
    const summary = this.generateVulnerabilitySummary(scanResults)
    const totalVulns = scanResults.length
    
    let riskLevel = 'Low'
    if (summary.critical > 0) riskLevel = 'Critical'
    else if (summary.high > 0) riskLevel = 'High'
    else if (summary.medium > 0) riskLevel = 'Medium'
    
    return {
      total_vulnerabilities: totalVulns,
      overall_risk_level: riskLevel,
      critical_issues: summary.critical,
      high_priority_issues: summary.high + summary.critical,
      key_findings: scanResults
        .filter(r => ['critical', 'high'].includes(r.risk_level))
        .slice(0, 5)
        .map(r => r.title),
      immediate_actions_required: summary.critical > 0 || summary.high > 0
    }
  }

  generateVulnerabilitySummary(scanResults) {
    return scanResults.reduce((acc, result) => {
      const level = result.risk_level || 'info'
      acc[level] = (acc[level] || 0) + 1
      return acc
    }, { critical: 0, high: 0, medium: 0, low: 0, info: 0 })
  }

  generateRecommendations(scanResults) {
    const recommendations = new Set()
    
    // Add general recommendations based on findings
    if (scanResults.some(r => r.risk_level === 'critical')) {
      recommendations.add('Address critical vulnerabilities immediately - these pose severe security risks')
    }
    
    if (scanResults.some(r => r.vulnerability_type?.toLowerCase().includes('sql'))) {
      recommendations.add('Implement parameterized queries to prevent SQL injection attacks')
    }
    
    if (scanResults.some(r => r.service === 'ssh')) {
      recommendations.add('Secure SSH access with key-based authentication and access restrictions')
    }
    
    if (scanResults.some(r => r.vulnerability_type?.toLowerCase().includes('ssl'))) {
      recommendations.add('Update SSL/TLS configuration to use strong cipher suites')
    }
    
    if (scanResults.some(r => r.port && [80, 443].includes(r.port))) {
      recommendations.add('Implement Web Application Firewall (WAF) for web services')
    }
    
    // Add general security recommendations
    recommendations.add('Implement regular security scanning and monitoring')
    recommendations.add('Keep all software and systems updated with latest security patches')
    recommendations.add('Conduct regular security awareness training for staff')
    recommendations.add('Implement network segmentation and access controls')
    recommendations.add('Establish incident response procedures')
    
    return Array.from(recommendations)
  }

  getToolsUsed(scanType) {
    const tools = {
      nmap: ['Nmap - Network port scanner'],
      nikto: ['Nikto - Web vulnerability scanner'],
      sqlmap: ['SQLMap - SQL injection testing tool'],
      zap: ['OWASP ZAP - Web application security scanner'],
      comprehensive: [
        'Nmap - Network port scanner',
        'Nikto - Web vulnerability scanner', 
        'SQLMap - SQL injection testing tool',
        'OWASP ZAP - Web application security scanner'
      ]
    }
    
    return tools[scanType] || ['Custom security assessment tools']
  }

  getMethodology(scanType) {
    return [
      'Automated vulnerability scanning',
      'Network service enumeration',
      'Web application security testing',
      'AI-powered vulnerability analysis',
      'Risk assessment and prioritization'
    ]
  }

  escapeCsvField(field) {
    if (typeof field !== 'string') return field
    
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return '"' + field.replace(/"/g, '""') + '"'
    }
    
    return field
  }
}

// Export singleton instance
const reportService = new ReportService()

module.exports = {
  generatePDFReport: (scan, scanResults) => reportService.generatePDFReport(scan, scanResults),
  generateCSVReport: (scan, scanResults) => reportService.generateCSVReport(scan, scanResults),
  generateJSONReport: (scan, scanResults) => reportService.generateJSONReport(scan, scanResults),
  ReportService
}
