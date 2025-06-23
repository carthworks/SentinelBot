const express = require('express')
const { body, param, query: expressQuery, validationResult } = require('express-validator')
const { query } = require('../database/connection')
const { AppError, catchAsync } = require('../middleware/errorHandler')
const { protect, restrictTo, authenticateApiKey, checkApiPermission } = require('../middleware/auth')
const { addScanJob, getScanJobStatus } = require('../services/queueService')
const logger = require('../utils/logger')
const validator = require('validator')

const router = express.Router()

// Validation rules
const createScanValidation = [
  body('target')
    .notEmpty()
    .withMessage('Target is required')
    .custom((value) => {
      // Validate if it's a valid domain, IP, or URL
      if (!validator.isURL(value, { require_protocol: false }) && 
          !validator.isIP(value) && 
          !validator.isFQDN(value)) {
        throw new Error('Target must be a valid domain, IP address, or URL')
      }
      return true
    }),
  body('scanType')
    .isIn(['nmap', 'nikto', 'sqlmap', 'zap', 'comprehensive'])
    .withMessage('Invalid scan type'),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Title must be less than 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters')
]

const updateScanValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Title must be less than 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters')
]

// Helper function to check validation errors
const checkValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg)
    return next(new AppError(errorMessages.join('. '), 400))
  }
  next()
}

// @desc    Get all scans for the authenticated user
// @route   GET /api/scans
// @access  Private
const getScans = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1
  const limit = parseInt(req.query.limit) || 10
  const offset = (page - 1) * limit
  const status = req.query.status
  const scanType = req.query.scan_type

  let whereClause = 'WHERE user_id = $1'
  const queryParams = [req.user.id]
  let paramCount = 1

  if (status) {
    paramCount++
    whereClause += ` AND status = $${paramCount}`
    queryParams.push(status)
  }

  if (scanType) {
    paramCount++
    whereClause += ` AND scan_type = $${paramCount}`
    queryParams.push(scanType)
  }

  // Get scans with summary data
  const scansResult = await query(`
    SELECT 
      s.*,
      COUNT(sr.id) as total_vulnerabilities,
      COUNT(CASE WHEN sr.risk_level = 'critical' THEN 1 END) as critical_count,
      COUNT(CASE WHEN sr.risk_level = 'high' THEN 1 END) as high_count,
      COUNT(CASE WHEN sr.risk_level = 'medium' THEN 1 END) as medium_count,
      COUNT(CASE WHEN sr.risk_level = 'low' THEN 1 END) as low_count,
      COUNT(CASE WHEN sr.risk_level = 'info' THEN 1 END) as info_count
    FROM scans s
    LEFT JOIN scan_results sr ON s.id = sr.scan_id
    ${whereClause}
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `, [...queryParams, limit, offset])

  // Get total count
  const countResult = await query(`
    SELECT COUNT(*) as total
    FROM scans s
    ${whereClause}
  `, queryParams)

  const total = parseInt(countResult.rows[0].total)
  const totalPages = Math.ceil(total / limit)

  res.status(200).json({
    status: 'success',
    data: {
      scans: scansResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  })
})

// @desc    Get a specific scan by ID
// @route   GET /api/scans/:id
// @access  Private
const getScan = catchAsync(async (req, res, next) => {
  const scanId = req.params.id

  // Get scan details
  const scanResult = await query(`
    SELECT s.*, u.email as user_email
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
    ORDER BY risk_level DESC, created_at DESC
  `, [scanId])

  scan.results = resultsQuery.rows

  // Get vulnerability summary
  const summaryResult = await query(`
    SELECT 
      risk_level,
      COUNT(*) as count
    FROM scan_results
    WHERE scan_id = $1
    GROUP BY risk_level
  `, [scanId])

  scan.vulnerability_summary = summaryResult.rows.reduce((acc, row) => {
    acc[row.risk_level] = parseInt(row.count)
    return acc
  }, {})

  res.status(200).json({
    status: 'success',
    data: {
      scan
    }
  })
})

// @desc    Create a new scan
// @route   POST /api/scans
// @access  Private
const createScan = catchAsync(async (req, res, next) => {
  const { target, scanType, title, description, options = {} } = req.body

  // Create scan record
  const result = await query(`
    INSERT INTO scans (user_id, target, scan_type, title, description, scan_options)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [req.user.id, target, scanType, title, description, JSON.stringify(options)])

  const scan = result.rows[0]

  // Add scan job to queue
  try {
    const job = await addScanJob({
      scanId: scan.id,
      target,
      scanType,
      options,
      userId: req.user.id
    })

    logger.logScan(scan.id, 'scan_created', { 
      target, 
      scanType, 
      userId: req.user.id,
      jobId: job.id 
    })

    res.status(201).json({
      status: 'success',
      data: {
        scan: {
          ...scan,
          jobId: job.id
        }
      }
    })
  } catch (error) {
    // If queue job fails, update scan status to error
    await query(
      'UPDATE scans SET status = $1, error_message = $2 WHERE id = $3',
      ['error', 'Failed to queue scan job', scan.id]
    )
    
    return next(new AppError('Failed to start scan. Please try again.', 500))
  }
})

// @desc    Update a scan
// @route   PUT /api/scans/:id
// @access  Private
const updateScan = catchAsync(async (req, res, next) => {
  const scanId = req.params.id
  const { title, description } = req.body

  // Check if scan exists and belongs to user
  const existingResult = await query(
    'SELECT id, status FROM scans WHERE id = $1 AND user_id = $2',
    [scanId, req.user.id]
  )

  if (existingResult.rows.length === 0) {
    return next(new AppError('Scan not found', 404))
  }

  // Update scan
  const result = await query(`
    UPDATE scans 
    SET title = COALESCE($1, title), 
        description = COALESCE($2, description),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3 AND user_id = $4
    RETURNING *
  `, [title, description, scanId, req.user.id])

  res.status(200).json({
    status: 'success',
    data: {
      scan: result.rows[0]
    }
  })
})

// @desc    Delete a scan
// @route   DELETE /api/scans/:id
// @access  Private
const deleteScan = catchAsync(async (req, res, next) => {
  const scanId = req.params.id

  // Check if scan exists and belongs to user
  const existingResult = await query(
    'SELECT id, status FROM scans WHERE id = $1 AND user_id = $2',
    [scanId, req.user.id]
  )

  if (existingResult.rows.length === 0) {
    return next(new AppError('Scan not found', 404))
  }

  const scan = existingResult.rows[0]

  // Don't allow deletion of running scans
  if (scan.status === 'running') {
    return next(new AppError('Cannot delete a running scan', 400))
  }

  // Delete scan (cascade will delete related records)
  await query('DELETE FROM scans WHERE id = $1', [scanId])

  logger.logScan(scanId, 'scan_deleted', { userId: req.user.id })

  res.status(204).json({
    status: 'success',
    data: null
  })
})

// @desc    Get scan statistics for user
// @route   GET /api/scans/stats
// @access  Private
const getScanStats = catchAsync(async (req, res, next) => {
  const statsResult = await query(`
    SELECT 
      COUNT(*) as total_scans,
      COUNT(CASE WHEN status = 'complete' THEN 1 END) as completed_scans,
      COUNT(CASE WHEN status = 'running' THEN 1 END) as running_scans,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_scans,
      COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_scans
    FROM scans
    WHERE user_id = $1
  `, [req.user.id])

  const vulnerabilityStats = await query(`
    SELECT 
      sr.risk_level,
      COUNT(*) as count
    FROM scan_results sr
    JOIN scans s ON sr.scan_id = s.id
    WHERE s.user_id = $1
    GROUP BY sr.risk_level
  `, [req.user.id])

  const recentScans = await query(`
    SELECT id, target, scan_type, status, created_at
    FROM scans
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 5
  `, [req.user.id])

  const stats = {
    ...statsResult.rows[0],
    vulnerability_breakdown: vulnerabilityStats.rows.reduce((acc, row) => {
      acc[row.risk_level] = parseInt(row.count)
      return acc
    }, {}),
    recent_scans: recentScans.rows
  }

  res.status(200).json({
    status: 'success',
    data: {
      stats
    }
  })
})

// Apply middleware and routes
router.use(protect) // All routes require authentication

router.get('/', getScans)
router.get('/stats', getScanStats)
router.get('/:id', param('id').isUUID().withMessage('Invalid scan ID'), checkValidationErrors, getScan)
router.post('/', createScanValidation, checkValidationErrors, createScan)
router.put('/:id', param('id').isUUID().withMessage('Invalid scan ID'), updateScanValidation, checkValidationErrors, updateScan)
router.delete('/:id', param('id').isUUID().withMessage('Invalid scan ID'), checkValidationErrors, deleteScan)

module.exports = router
