const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const { query } = require('../database/connection')
const { AppError, catchAsync } = require('../middleware/errorHandler')
const { createSendToken, protect } = require('../middleware/auth')
const logger = require('../utils/logger')

const router = express.Router()

// Validation rules
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
]

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
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

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = catchAsync(async (req, res, next) => {
  const { email, password, firstName, lastName } = req.body

  // Check if user already exists
  const existingUser = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  )

  if (existingUser.rows.length > 0) {
    return next(new AppError('User with this email already exists', 409))
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12)

  // Create user
  const result = await query(
    `INSERT INTO users (email, password_hash, first_name, last_name) 
     VALUES ($1, $2, $3, $4) 
     RETURNING id, email, first_name, last_name, role, is_active, is_verified, created_at`,
    [email, passwordHash, firstName, lastName]
  )

  const newUser = result.rows[0]

  logger.info('New user registered:', { userId: newUser.id, email: newUser.email })

  // Create and send token
  createSendToken(newUser, 201, res)
})

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body

  // Check if user exists and get password
  const result = await query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  )

  if (result.rows.length === 0) {
    logger.logSecurity('Login attempt with non-existent email', { email })
    return next(new AppError('Invalid email or password', 401))
  }

  const user = result.rows[0]

  // Check if user is active
  if (!user.is_active) {
    logger.logSecurity('Login attempt with deactivated account', { email, userId: user.id })
    return next(new AppError('Your account has been deactivated. Please contact support.', 401))
  }

  // Check password
  const isPasswordCorrect = await bcrypt.compare(password, user.password_hash)

  if (!isPasswordCorrect) {
    logger.logSecurity('Failed login attempt', { email, userId: user.id })
    return next(new AppError('Invalid email or password', 401))
  }

  logger.info('User logged in successfully:', { userId: user.id, email: user.email })

  // Create and send token
  createSendToken(user, 200, res)
})

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
const refreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body

  if (!refreshToken) {
    return next(new AppError('Refresh token is required', 400))
  }

  // Verify refresh token
  let decoded
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
  } catch (error) {
    return next(new AppError('Invalid or expired refresh token', 401))
  }

  // Check if refresh token exists in database and is not revoked
  const tokenResult = await query(
    `SELECT rt.*, u.id, u.email, u.first_name, u.last_name, u.role, u.is_active, u.is_verified
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.user_id = $1 AND rt.expires_at > CURRENT_TIMESTAMP AND rt.is_revoked = false`,
    [decoded.id]
  )

  if (tokenResult.rows.length === 0) {
    return next(new AppError('Invalid or expired refresh token', 401))
  }

  const user = tokenResult.rows[0]

  // Check if user is still active
  if (!user.is_active) {
    return next(new AppError('Account has been deactivated', 401))
  }

  // Generate new access token
  const newAccessToken = require('../middleware/auth').signToken(user.id)

  res.status(200).json({
    status: 'success',
    token: newAccessToken,
    data: {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_verified: user.is_verified
      }
    }
  })
})

// @desc    Logout user (revoke refresh token)
// @route   POST /api/auth/logout
// @access  Private
const logout = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body

  if (refreshToken) {
    // Revoke the specific refresh token
    await query(
      'UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1',
      [bcrypt.hashSync(refreshToken, 12)]
    )
  }

  // Revoke all refresh tokens for the user (logout from all devices)
  if (req.user) {
    await query(
      'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1',
      [req.user.id]
    )
  }

  logger.info('User logged out:', { userId: req.user?.id })

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  })
})

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = catchAsync(async (req, res, next) => {
  const result = await query(
    'SELECT id, email, first_name, last_name, role, is_active, is_verified, created_at, last_login FROM users WHERE id = $1',
    [req.user.id]
  )

  res.status(200).json({
    status: 'success',
    data: {
      user: result.rows[0]
    }
  })
})

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    return next(new AppError('Current password and new password are required', 400))
  }

  // Get user with password
  const result = await query(
    'SELECT password_hash FROM users WHERE id = $1',
    [req.user.id]
  )

  const user = result.rows[0]

  // Check current password
  const isCurrentPasswordCorrect = await bcrypt.compare(currentPassword, user.password_hash)

  if (!isCurrentPasswordCorrect) {
    return next(new AppError('Current password is incorrect', 400))
  }

  // Validate new password
  if (newPassword.length < 8) {
    return next(new AppError('New password must be at least 8 characters long', 400))
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 12)

  // Update password
  await query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [newPasswordHash, req.user.id]
  )

  // Revoke all refresh tokens (force re-login on all devices)
  await query(
    'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1',
    [req.user.id]
  )

  logger.info('Password changed successfully:', { userId: req.user.id })

  res.status(200).json({
    status: 'success',
    message: 'Password changed successfully. Please log in again.'
  })
})

// Apply routes
router.post('/register', registerValidation, checkValidationErrors, register)
router.post('/login', loginValidation, checkValidationErrors, login)
router.post('/refresh', refreshToken)
router.post('/logout', protect, logout)
router.get('/me', protect, getMe)
router.put('/change-password', protect, changePassword)

module.exports = router
