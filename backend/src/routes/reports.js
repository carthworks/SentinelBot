const express = require('express')
const { param, validationResult } = require('express-validator')
const { query } = require('../database/connection')
const { AppError, catchAsync } = require('../middleware/errorHandler')
const { protect } = require('../middleware/auth')
const { generatePDFReport, generateCSVReport, generateJSONReport } = require('../services/reportService')
const logger = require('../utils/logger')

const router = express.Router()

// Helper function to check validation errors
const checkValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg)
    return next(new AppError(errorMessages.join('. '), 400))
  }
  next()
}

// @desc    Download PDF report for a scan
// @route   GET /api/reports/:scanId/pdf
// @access  Private
const downloadPDFReport = catchAsync(async (req, res, next) => {
  const { scanId } = req.params

  // Verify scan exists and belongs to user
  const scanResult = await query(`
    SELECT s.*, u.email as user_email, u.first_name, u.last_name
    FROM scans s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = $1 AND s.user_id = $2
  `, [scanId, req.user.id])

  if (scanResult.rows.length === 0) {
    return next(new AppError('Scan not found', 404))
  }

  const scan = scanResult.rows[0]

  // Get scan results
  const resultsQuery = await query(`
    SELECT *
    FROM scan_results
    WHERE scan_id = $1
    ORDER BY 
      CASE risk_level 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
        WHEN 'info' THEN 5 
      END,
      created_at DESC
  `, [scanId])

  const scanResults = resultsQuery.rows

  // Generate PDF report
  const pdfBuffer = await generatePDFReport(scan, scanResults)

  // Set response headers
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="sentinelbot-report-${scanId}.pdf"`)
  res.setHeader('Content-Length', pdfBuffer.length)

  // Log report generation
  logger.info('PDF report generated:', { 
    scanId, 
    userId: req.user.id, 
    target: scan.target,
    vulnerabilities: scanResults.length 
  })

  res.send(pdfBuffer)
})

// @desc    Download CSV report for a scan
// @route   GET /api/reports/:scanId/csv
// @access  Private
const downloadCSVReport = catchAsync(async (req, res, next) => {
  const { scanId } = req.params

  // Verify scan exists and belongs to user
  const scanResult = await query(`
    SELECT s.*
    FROM scans s
    WHERE s.id = $1 AND s.user_id = $2
  `, [scanId, req.user.id])

  if (scanResult.rows.length === 0) {
    return next(new AppError('Scan not found', 404))
  }

  const scan = scanResult.rows[0]

  // Get scan results
  const resultsQuery = await query(`
    SELECT 
      vulnerability_type,
      risk_level,
      title,
      description,
      fix_suggestion,
      cvss_score,
      cve_id,
      affected_component,
      port,
      service,
      created_at
    FROM scan_results
    WHERE scan_id = $1
    ORDER BY 
      CASE risk_level 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
        WHEN 'info' THEN 5 
      END,
      created_at DESC
  `, [scanId])

  const scanResults = resultsQuery.rows

  // Generate CSV report
  const csvContent = await generateCSVReport(scan, scanResults)

  // Set response headers
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="sentinelbot-report-${scanId}.csv"`)

  // Log report generation
  logger.info('CSV report generated:', { 
    scanId, 
    userId: req.user.id, 
    target: scan.target,
    vulnerabilities: scanResults.length 
  })

  res.send(csvContent)
})

// @desc    Download JSON report for a scan
// @route   GET /api/reports/:scanId/json
// @access  Private
const downloadJSONReport = catchAsync(async (req, res, next) => {
  const { scanId } = req.params

  // Verify scan exists and belongs to user
  const scanResult = await query(`
    SELECT s.*, u.email as user_email, u.first_name, u.last_name
    FROM scans s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = $1 AND s.user_id = $2
  `, [scanId, req.user.id])

  if (scanResult.rows.length === 0) {
    return next(new AppError('Scan not found', 404))
  }

  const scan = scanResult.rows[0]

  // Get scan results
  const resultsQuery = await query(`
    SELECT *
    FROM scan_results
    WHERE scan_id = $1
    ORDER BY 
      CASE risk_level 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
        WHEN 'info' THEN 5 
      END,
      created_at DESC
  `, [scanId])

  const scanResults = resultsQuery.rows

  // Generate JSON report
  const jsonReport = generateJSONReport(scan, scanResults)

  // Set response headers
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="sentinelbot-report-${scanId}.json"`)

  // Log report generation
  logger.info('JSON report generated:', { 
    scanId, 
    userId: req.user.id, 
    target: scan.target,
    vulnerabilities: scanResults.length 
  })

  res.json(jsonReport)
})

// @desc    Get report metadata for a scan
// @route   GET /api/reports/:scanId/metadata
// @access  Private
const getReportMetadata = catchAsync(async (req, res, next) => {
  const { scanId } = req.params

  // Verify scan exists and belongs to user
  const scanResult = await query(`
    SELECT s.id, s.target, s.scan_type, s.status, s.created_at, s.completed_at
    FROM scans s
    WHERE s.id = $1 AND s.user_id = $2
  `, [scanId, req.user.id])

  if (scanResult.rows.length === 0) {
    return next(new AppError('Scan not found', 404))
  }

  const scan = scanResult.rows[0]

  // Get vulnerability summary
  const summaryResult = await query(`
    SELECT 
      COUNT(*) as total_vulnerabilities,
      COUNT(CASE WHEN risk_level = 'critical' THEN 1 END) as critical_count,
      COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high_count,
      COUNT(CASE WHEN risk_level = 'medium' THEN 1 END) as medium_count,
      COUNT(CASE WHEN risk_level = 'low' THEN 1 END) as low_count,
      COUNT(CASE WHEN risk_level = 'info' THEN 1 END) as info_count
    FROM scan_results
    WHERE scan_id = $1
  `, [scanId])

  const summary = summaryResult.rows[0]

  // Get existing report files
  const reportsResult = await query(`
    SELECT report_type, file_size, generated_at
    FROM scan_reports
    WHERE scan_id = $1
    ORDER BY generated_at DESC
  `, [scanId])

  const metadata = {
    scan: {
      id: scan.id,
      target: scan.target,
      scan_type: scan.scan_type,
      status: scan.status,
      created_at: scan.created_at,
      completed_at: scan.completed_at
    },
    summary: {
      total_vulnerabilities: parseInt(summary.total_vulnerabilities),
      critical_count: parseInt(summary.critical_count),
      high_count: parseInt(summary.high_count),
      medium_count: parseInt(summary.medium_count),
      low_count: parseInt(summary.low_count),
      info_count: parseInt(summary.info_count)
    },
    available_formats: ['pdf', 'csv', 'json'],
    existing_reports: reportsResult.rows
  }

  res.status(200).json({
    status: 'success',
    data: metadata
  })
})

// Apply middleware and routes
router.use(protect) // All routes require authentication

router.get('/:scanId/pdf', 
  param('scanId').isUUID().withMessage('Invalid scan ID'), 
  checkValidationErrors, 
  downloadPDFReport
)

router.get('/:scanId/csv', 
  param('scanId').isUUID().withMessage('Invalid scan ID'), 
  checkValidationErrors, 
  downloadCSVReport
)

router.get('/:scanId/json', 
  param('scanId').isUUID().withMessage('Invalid scan ID'), 
  checkValidationErrors, 
  downloadJSONReport
)

router.get('/:scanId/metadata', 
  param('scanId').isUUID().withMessage('Invalid scan ID'), 
  checkValidationErrors, 
  getReportMetadata
)

module.exports = router
