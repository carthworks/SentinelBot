const logger = require('../utils/logger')

class AppError extends Error {
  constructor (message, statusCode, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'

    Error.captureStackTrace(this, this.constructor)
  }
}

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`
  return new AppError(message, 400)
}

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg ? err.errmsg.match(/(["'])(\\?.)*?\1/)[0] : 'duplicate value'
  const message = `Duplicate field value: ${value}. Please use another value!`
  return new AppError(message, 400)
}

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message)
  const message = `Invalid input data. ${errors.join('. ')}`
  return new AppError(message, 400)
}

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401)

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401)

const handlePostgresError = (err) => {
  // Handle specific PostgreSQL errors
  switch (err.code) {
    case '23505': // unique_violation
      return new AppError('Duplicate entry. This record already exists.', 409)
    case '23503': // foreign_key_violation
      return new AppError('Referenced record does not exist.', 400)
    case '23502': // not_null_violation
      return new AppError(`Missing required field: ${err.column}`, 400)
    case '23514': // check_violation
      return new AppError('Data validation failed.', 400)
    case '42P01': // undefined_table
      return new AppError('Database table not found.', 500)
    case '42703': // undefined_column
      return new AppError('Database column not found.', 500)
    default:
      return new AppError('Database operation failed.', 500)
  }
}

const sendErrorDev = (err, req, res) => {
  // API
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method
    })
  }

  // RENDERED WEBSITE
  logger.error('ERROR 💥', err)
  return res.status(err.statusCode).json({
    title: 'Something went wrong!',
    msg: err.message
  })
}

const sendErrorProd = (err, req, res) => {
  // A) API
  if (req.originalUrl.startsWith('/api')) {
    // A) Operational, trusted error: send message to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
        timestamp: new Date().toISOString()
      })
    }
    // B) Programming or other unknown error: don't leak error details
    // 1) Log error
    logger.error('ERROR 💥', err)

    // 2) Send generic message
    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
      timestamp: new Date().toISOString()
    })
  }

  // B) RENDERED WEBSITE
  // A) Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      title: 'Something went wrong!',
      msg: err.message
    })
  }
  // B) Programming or other unknown error: don't leak error details
  // 1) Log error
  logger.error('ERROR 💥', err)

  // 2) Send generic message
  return res.status(err.statusCode).json({
    title: 'Something went wrong!',
    msg: 'Please try again later.'
  })
}

const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500
  err.status = err.status || 'error'

  // Log the error
  logger.error('Global Error Handler:', {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  })

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res)
  } else {
    let error = { ...err }
    error.message = err.message

    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error)
    if (error.code === 11000) error = handleDuplicateFieldsDB(error)
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error)
    if (error.name === 'JsonWebTokenError') error = handleJWTError()
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError()
    
    // Handle PostgreSQL errors
    if (error.code && typeof error.code === 'string' && error.code.length === 5) {
      error = handlePostgresError(error)
    }

    sendErrorProd(error, req, res)
  }
}

// Async error wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}

module.exports = {
  AppError,
  globalErrorHandler,
  catchAsync
}
