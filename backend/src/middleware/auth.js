const jwt = require('jsonwebtoken')
const { query } = require('../database/connection')
const { AppError, catchAsync } = require('./errorHandler')
const logger = require('../utils/logger')

// Generate JWT token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  })
}

// Generate refresh token
const signRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  })
}

// Create and send token response
const createSendToken = async (user, statusCode, res) => {
  const token = signToken(user.id)
  const refreshToken = signRefreshToken(user.id)

  // Store refresh token in database
  const refreshTokenHash = require('bcryptjs').hashSync(refreshToken, 12)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, refreshTokenHash, expiresAt]
  )

  // Remove password from output
  const { password_hash, ...userWithoutPassword } = user

  res.status(statusCode).json({
    status: 'success',
    token,
    refreshToken,
    data: {
      user: userWithoutPassword
    }
  })
}

// Protect middleware - verify JWT token
const protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1]
  }

  if (!token) {
    return next(new AppError('You are not logged in! Please log in to get access.', 401))
  }

  // 2) Verification token
  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET)
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired! Please log in again.', 401))
    }
    return next(new AppError('Invalid token. Please log in again!', 401))
  }

  // 3) Check if user still exists
  const result = await query(
    'SELECT id, email, first_name, last_name, role, is_active, is_verified FROM users WHERE id = $1',
    [decoded.id]
  )

  if (result.rows.length === 0) {
    return next(new AppError('The user belonging to this token does no longer exist.', 401))
  }

  const currentUser = result.rows[0]

  // 4) Check if user is active
  if (!currentUser.is_active) {
    return next(new AppError('Your account has been deactivated. Please contact support.', 401))
  }

  // 5) Update last login
  await query(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
    [currentUser.id]
  )

  // Grant access to protected route
  req.user = currentUser
  next()
})

// Restrict to certain roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403))
    }
    next()
  }
}

// Optional authentication - doesn't fail if no token
const optionalAuth = catchAsync(async (req, res, next) => {
  let token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1]
  }

  if (!token) {
    return next()
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const result = await query(
      'SELECT id, email, first_name, last_name, role, is_active, is_verified FROM users WHERE id = $1',
      [decoded.id]
    )

    if (result.rows.length > 0 && result.rows[0].is_active) {
      req.user = result.rows[0]
    }
  } catch (error) {
    // Ignore token errors for optional auth
    logger.debug('Optional auth token error:', error.message)
  }

  next()
})

// API Key authentication
const authenticateApiKey = catchAsync(async (req, res, next) => {
  const apiKey = req.headers['x-api-key']

  if (!apiKey) {
    return next(new AppError('API key is required', 401))
  }

  // Find API key in database
  const result = await query(`
    SELECT ak.*, u.id as user_id, u.email, u.role, u.is_active
    FROM api_keys ak
    JOIN users u ON ak.user_id = u.id
    WHERE ak.key_hash = $1 AND ak.is_active = true AND (ak.expires_at IS NULL OR ak.expires_at > CURRENT_TIMESTAMP)
  `, [require('bcryptjs').hashSync(apiKey, 12)])

  if (result.rows.length === 0) {
    logger.logSecurity('Invalid API key used', { apiKey: apiKey.substring(0, 8) + '...' })
    return next(new AppError('Invalid or expired API key', 401))
  }

  const apiKeyData = result.rows[0]

  // Check if user is active
  if (!apiKeyData.is_active) {
    return next(new AppError('API key owner account is deactivated', 401))
  }

  // Update last used timestamp
  await query(
    'UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = $1',
    [apiKeyData.id]
  )

  // Set user data for the request
  req.user = {
    id: apiKeyData.user_id,
    email: apiKeyData.email,
    role: apiKeyData.role,
    is_active: apiKeyData.is_active
  }
  req.apiKey = {
    id: apiKeyData.id,
    name: apiKeyData.key_name,
    permissions: apiKeyData.permissions
  }

  next()
})

// Check API key permissions
const checkApiPermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return next() // Not using API key auth
    }

    const permissions = req.apiKey.permissions
    if (!permissions[resource] || !permissions[resource].includes(action)) {
      return next(new AppError(`API key does not have permission to ${action} ${resource}`, 403))
    }

    next()
  }
}

module.exports = {
  signToken,
  signRefreshToken,
  createSendToken,
  protect,
  restrictTo,
  optionalAuth,
  authenticateApiKey,
  checkApiPermission
}
