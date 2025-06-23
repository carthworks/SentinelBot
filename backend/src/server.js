const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const compression = require('compression')
const rateLimit = require('express-rate-limit')
require('express-async-errors')
require('dotenv').config()

const logger = require('./utils/logger')
const { globalErrorHandler } = require('./middleware/errorHandler')
const { connectDatabase } = require('./database/connection')
const { initializeQueue } = require('./services/queueService')

// Import routes
const authRoutes = require('./routes/auth')
const scanRoutes = require('./routes/scans')
const reportRoutes = require('./routes/reports')
const userRoutes = require('./routes/users')

const app = express()
const PORT = process.env.PORT || 5000

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}))

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false
})

app.use('/api/', limiter)

// Body parsing middleware
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }))
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  })
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/scans', scanRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/users', userRoutes)

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'SentinelBot API',
    version: '1.0.0',
    description: 'Automated Cybersecurity Pentest Platform API',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'User registration',
        'POST /api/auth/login': 'User login',
        'POST /api/auth/refresh': 'Refresh access token',
        'POST /api/auth/logout': 'User logout'
      },
      scans: {
        'GET /api/scans': 'List user scans',
        'POST /api/scans': 'Create new scan',
        'GET /api/scans/:id': 'Get scan details',
        'PUT /api/scans/:id': 'Update scan',
        'DELETE /api/scans/:id': 'Delete scan'
      },
      reports: {
        'GET /api/reports/:scanId/pdf': 'Download PDF report',
        'GET /api/reports/:scanId/csv': 'Download CSV report',
        'GET /api/reports/:scanId/json': 'Download JSON report'
      },
      users: {
        'GET /api/users/profile': 'Get user profile',
        'PUT /api/users/profile': 'Update user profile',
        'GET /api/users/stats': 'Get user statistics'
      }
    },
    documentation: 'https://docs.sentinelbot.com'
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  })
})

// Error handling middleware (must be last)
app.use(globalErrorHandler)

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully')
  process.exit(0)
})

// Start server
async function startServer () {
  try {
    // Initialize database connection
    await connectDatabase()
    logger.info('Database connected successfully')

    // Initialize queue system
    await initializeQueue()
    logger.info('Queue system initialized')

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`SentinelBot API server running on port ${PORT}`)
      logger.info(`Environment: ${process.env.NODE_ENV}`)
      logger.info(`Health check: http://localhost:${PORT}/health`)
      logger.info(`API documentation: http://localhost:${PORT}/api`)
    })

    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error:', error)
      process.exit(1)
    })

    return server
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer()
}

module.exports = { app, startServer }
