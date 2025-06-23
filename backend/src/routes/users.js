const express = require('express')
const { body, validationResult } = require('express-validator')
const { query } = require('../database/connection')
const { AppError, catchAsync } = require('../middleware/errorHandler')
const { protect } = require('../middleware/auth')
const logger = require('../utils/logger')

const router = express.Router()

// Validation rules
const updateProfileValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
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

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = catchAsync(async (req, res, next) => {
  const result = await query(`
    SELECT 
      id, email, first_name, last_name, role, is_active, 
      is_verified, created_at, last_login
    FROM users 
    WHERE id = $1
  `, [req.user.id])

  if (result.rows.length === 0) {
    return next(new AppError('User not found', 404))
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: result.rows[0]
    }
  })
})

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email } = req.body

  // Check if email is already taken by another user
  if (email) {
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, req.user.id]
    )

    if (existingUser.rows.length > 0) {
      return next(new AppError('Email is already taken by another user', 409))
    }
  }

  // Update user profile
  const result = await query(`
    UPDATE users 
    SET 
      first_name = COALESCE($1, first_name),
      last_name = COALESCE($2, last_name),
      email = COALESCE($3, email),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING id, email, first_name, last_name, role, is_active, is_verified, created_at, updated_at
  `, [firstName, lastName, email, req.user.id])

  logger.info('User profile updated:', { 
    userId: req.user.id, 
    changes: { firstName, lastName, email } 
  })

  res.status(200).json({
    status: 'success',
    data: {
      user: result.rows[0]
    }
  })
})

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private
const getUserStats = catchAsync(async (req, res, next) => {
  // Get scan statistics
  const scanStats = await query(`
    SELECT 
      COUNT(*) as total_scans,
      COUNT(CASE WHEN status = 'complete' THEN 1 END) as completed_scans,
      COUNT(CASE WHEN status = 'running' THEN 1 END) as running_scans,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_scans,
      COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_scans,
      COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as scans_last_30_days,
      COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as scans_last_7_days
    FROM scans
    WHERE user_id = $1
  `, [req.user.id])

  // Get vulnerability statistics
  const vulnStats = await query(`
    SELECT 
      COUNT(*) as total_vulnerabilities,
      COUNT(CASE WHEN sr.risk_level = 'critical' THEN 1 END) as critical_vulnerabilities,
      COUNT(CASE WHEN sr.risk_level = 'high' THEN 1 END) as high_vulnerabilities,
      COUNT(CASE WHEN sr.risk_level = 'medium' THEN 1 END) as medium_vulnerabilities,
      COUNT(CASE WHEN sr.risk_level = 'low' THEN 1 END) as low_vulnerabilities,
      COUNT(CASE WHEN sr.risk_level = 'info' THEN 1 END) as info_vulnerabilities
    FROM scan_results sr
    JOIN scans s ON sr.scan_id = s.id
    WHERE s.user_id = $1
  `, [req.user.id])

  // Get scan type breakdown
  const scanTypeStats = await query(`
    SELECT 
      scan_type,
      COUNT(*) as count
    FROM scans
    WHERE user_id = $1
    GROUP BY scan_type
    ORDER BY count DESC
  `, [req.user.id])

  // Get recent activity
  const recentActivity = await query(`
    SELECT 
      id, target, scan_type, status, created_at, completed_at
    FROM scans
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 10
  `, [req.user.id])

  // Get monthly scan trend (last 6 months)
  const monthlyTrend = await query(`
    SELECT 
      DATE_TRUNC('month', created_at) as month,
      COUNT(*) as scan_count
    FROM scans
    WHERE user_id = $1 
      AND created_at >= CURRENT_DATE - INTERVAL '6 months'
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month DESC
  `, [req.user.id])

  const stats = {
    scan_statistics: scanStats.rows[0],
    vulnerability_statistics: vulnStats.rows[0],
    scan_type_breakdown: scanTypeStats.rows,
    recent_activity: recentActivity.rows,
    monthly_trend: monthlyTrend.rows,
    account_info: {
      member_since: req.user.created_at,
      last_login: req.user.last_login,
      total_reports_generated: 0 // Could be tracked separately
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      stats
    }
  })
})

// @desc    Get user API keys
// @route   GET /api/users/api-keys
// @access  Private
const getApiKeys = catchAsync(async (req, res, next) => {
  const result = await query(`
    SELECT 
      id, key_name, permissions, last_used, expires_at, 
      is_active, created_at
    FROM api_keys
    WHERE user_id = $1
    ORDER BY created_at DESC
  `, [req.user.id])

  res.status(200).json({
    status: 'success',
    data: {
      api_keys: result.rows
    }
  })
})

// @desc    Create new API key
// @route   POST /api/users/api-keys
// @access  Private
const createApiKey = catchAsync(async (req, res, next) => {
  const { keyName, permissions, expiresAt } = req.body

  if (!keyName) {
    return next(new AppError('API key name is required', 400))
  }

  // Generate API key
  const crypto = require('crypto')
  const apiKey = `sb_${crypto.randomBytes(32).toString('hex')}`
  const keyHash = require('bcryptjs').hashSync(apiKey, 12)

  // Insert API key
  const result = await query(`
    INSERT INTO api_keys (user_id, key_name, key_hash, permissions, expires_at)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, key_name, permissions, expires_at, is_active, created_at
  `, [
    req.user.id,
    keyName,
    keyHash,
    JSON.stringify(permissions || { scans: ['read', 'create'], reports: ['read'] }),
    expiresAt
  ])

  logger.info('API key created:', { 
    userId: req.user.id, 
    keyName,
    keyId: result.rows[0].id 
  })

  res.status(201).json({
    status: 'success',
    data: {
      api_key: {
        ...result.rows[0],
        key: apiKey // Only returned once during creation
      }
    }
  })
})

// @desc    Revoke API key
// @route   DELETE /api/users/api-keys/:keyId
// @access  Private
const revokeApiKey = catchAsync(async (req, res, next) => {
  const { keyId } = req.params

  // Check if API key exists and belongs to user
  const existingResult = await query(
    'SELECT id FROM api_keys WHERE id = $1 AND user_id = $2',
    [keyId, req.user.id]
  )

  if (existingResult.rows.length === 0) {
    return next(new AppError('API key not found', 404))
  }

  // Deactivate API key
  await query(
    'UPDATE api_keys SET is_active = false WHERE id = $1',
    [keyId]
  )

  logger.info('API key revoked:', { 
    userId: req.user.id, 
    keyId 
  })

  res.status(204).json({
    status: 'success',
    data: null
  })
})

// Apply middleware and routes
router.use(protect) // All routes require authentication

router.get('/profile', getProfile)
router.put('/profile', updateProfileValidation, checkValidationErrors, updateProfile)
router.get('/stats', getUserStats)
router.get('/api-keys', getApiKeys)
router.post('/api-keys', createApiKey)
router.delete('/api-keys/:keyId', revokeApiKey)

module.exports = router
