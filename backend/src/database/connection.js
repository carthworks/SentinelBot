const { Pool } = require('pg')
const logger = require('../utils/logger')

let pool = null

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'sentinelbot',
  user: process.env.DB_USER || 'sentinelbot',
  password: process.env.DB_PASSWORD || 'sentinelbot123',
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle
  connectionTimeoutMillis: 2000, // how long to wait when connecting a new client
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
}

// Use DATABASE_URL if provided (common in production environments)
if (process.env.DATABASE_URL) {
  dbConfig.connectionString = process.env.DATABASE_URL
  if (process.env.NODE_ENV === 'production') {
    dbConfig.ssl = { rejectUnauthorized: false }
  }
}

async function connectDatabase () {
  try {
    if (!pool) {
      pool = new Pool(dbConfig)

      // Test the connection
      const client = await pool.connect()
      const result = await client.query('SELECT NOW()')
      client.release()

      logger.info('Database connection established successfully')
      logger.info(`Connected to database: ${dbConfig.database}`)
      logger.info(`Database time: ${result.rows[0].now}`)

      // Handle pool errors
      pool.on('error', (err) => {
        logger.error('Unexpected error on idle client', err)
      })

      // Handle pool connection events
      pool.on('connect', (client) => {
        logger.debug('New client connected to database')
      })

      pool.on('acquire', (client) => {
        logger.debug('Client acquired from pool')
      })

      pool.on('remove', (client) => {
        logger.debug('Client removed from pool')
      })
    }

    return pool
  } catch (error) {
    logger.error('Failed to connect to database:', error)
    throw error
  }
}

async function disconnectDatabase () {
  if (pool) {
    try {
      await pool.end()
      pool = null
      logger.info('Database connection closed')
    } catch (error) {
      logger.error('Error closing database connection:', error)
      throw error
    }
  }
}

function getPool () {
  if (!pool) {
    throw new Error('Database not connected. Call connectDatabase() first.')
  }
  return pool
}

async function query (text, params) {
  const client = await getPool().connect()
  try {
    const start = Date.now()
    const result = await client.query(text, params)
    const duration = Date.now() - start

    if (process.env.NODE_ENV === 'development') {
      logger.debug('Executed query', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: result.rowCount
      })
    }

    return result
  } catch (error) {
    logger.error('Database query error:', {
      error: error.message,
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      params: params ? params.map(p => typeof p === 'string' && p.length > 50 ? p.substring(0, 50) + '...' : p) : undefined
    })
    throw error
  } finally {
    client.release()
  }
}

async function transaction (callback) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    logger.error('Transaction rolled back:', error)
    throw error
  } finally {
    client.release()
  }
}

// Health check function
async function healthCheck () {
  try {
    const result = await query('SELECT 1 as health_check')
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      response_time: Date.now()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}

// Get database statistics
async function getStats () {
  try {
    const poolStats = {
      total_connections: pool.totalCount,
      idle_connections: pool.idleCount,
      waiting_requests: pool.waitingCount
    }

    const dbStats = await query(`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples
      FROM pg_stat_user_tables
      ORDER BY schemaname, tablename
    `)

    return {
      pool: poolStats,
      tables: dbStats.rows
    }
  } catch (error) {
    logger.error('Error getting database stats:', error)
    throw error
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  getPool,
  query,
  transaction,
  healthCheck,
  getStats
}
