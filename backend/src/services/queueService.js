const { Queue, Worker } = require('bullmq')
const Redis = require('ioredis')
const logger = require('../utils/logger')
const { query } = require('../database/connection')

// Redis connection
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true
})

// Create scan queue
const scanQueue = new Queue('scan-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
})

// Scan worker
let scanWorker = null

const initializeQueue = async () => {
  try {
    // Test Redis connection
    await redisConnection.ping()
    logger.info('Redis connection established')

    // Initialize worker
    scanWorker = new Worker('scan-processing', async (job) => {
      const { scanId, target, scanType, options } = job.data
      
      logger.logScan(scanId, 'scan_started', { target, scanType })
      
      try {
        // Update scan status to running
        await query(
          'UPDATE scans SET status = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['running', scanId]
        )

        // Execute the scan based on type
        const scanResults = await executeScan(scanId, target, scanType, options, job)

        // Update scan status to complete
        await query(
          'UPDATE scans SET status = $1, completed_at = CURRENT_TIMESTAMP, progress = 100 WHERE id = $2',
          ['complete', scanId]
        )

        logger.logScan(scanId, 'scan_completed', { 
          target, 
          scanType, 
          vulnerabilities: scanResults.length 
        })

        return { success: true, vulnerabilities: scanResults.length }
      } catch (error) {
        logger.error('Scan execution failed:', { scanId, error: error.message })
        
        // Update scan status to error
        await query(
          'UPDATE scans SET status = $1, error_message = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $3',
          ['error', error.message, scanId]
        )

        throw error
      }
    }, {
      connection: redisConnection,
      concurrency: 3 // Process up to 3 scans simultaneously
    })

    // Worker event handlers
    scanWorker.on('completed', (job, result) => {
      logger.info('Scan job completed:', { jobId: job.id, result })
    })

    scanWorker.on('failed', (job, err) => {
      logger.error('Scan job failed:', { jobId: job.id, error: err.message })
    })

    scanWorker.on('progress', (job, progress) => {
      logger.debug('Scan progress:', { jobId: job.id, progress })
    })

    logger.info('Queue system initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize queue system:', error)
    throw error
  }
}

const addScanJob = async (scanData) => {
  try {
    const job = await scanQueue.add('process-scan', scanData, {
      priority: scanData.priority || 0,
      delay: scanData.delay || 0
    })

    logger.info('Scan job added to queue:', { 
      jobId: job.id, 
      scanId: scanData.scanId,
      target: scanData.target 
    })

    return job
  } catch (error) {
    logger.error('Failed to add scan job to queue:', error)
    throw error
  }
}

const getScanJobStatus = async (jobId) => {
  try {
    const job = await scanQueue.getJob(jobId)
    if (!job) {
      return null
    }

    return {
      id: job.id,
      progress: job.progress,
      state: await job.getState(),
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn
    }
  } catch (error) {
    logger.error('Failed to get scan job status:', error)
    throw error
  }
}

const getQueueStats = async () => {
  try {
    const waiting = await scanQueue.getWaiting()
    const active = await scanQueue.getActive()
    const completed = await scanQueue.getCompleted()
    const failed = await scanQueue.getFailed()

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length
    }
  } catch (error) {
    logger.error('Failed to get queue stats:', error)
    throw error
  }
}

// Execute scan based on type
const executeScan = async (scanId, target, scanType, options = {}, job) => {
  const scanners = require('./scannerService')
  const aiAnalyzer = require('./aiAnalyzer')
  
  let results = []

  try {
    // Update progress
    await job.updateProgress(10)

    switch (scanType) {
      case 'nmap':
        results = await scanners.runNmapScan(target, options)
        break
      case 'nikto':
        results = await scanners.runNiktoScan(target, options)
        break
      case 'sqlmap':
        results = await scanners.runSqlmapScan(target, options)
        break
      case 'zap':
        results = await scanners.runZapScan(target, options)
        break
      case 'comprehensive':
        // Run multiple scans
        await job.updateProgress(20)
        const nmapResults = await scanners.runNmapScan(target, options)
        
        await job.updateProgress(40)
        const niktoResults = await scanners.runNiktoScan(target, options)
        
        await job.updateProgress(60)
        const sqlmapResults = await scanners.runSqlmapScan(target, options)
        
        results = [...nmapResults, ...niktoResults, ...sqlmapResults]
        break
      default:
        throw new Error(`Unsupported scan type: ${scanType}`)
    }

    await job.updateProgress(80)

    // Process results with AI analyzer
    const processedResults = []
    for (const result of results) {
      const aiAnalysis = await aiAnalyzer.analyzeVulnerability(result)
      
      // Store result in database
      const dbResult = await query(`
        INSERT INTO scan_results (
          scan_id, vulnerability_type, risk_level, title, description, 
          fix_suggestion, cvss_score, cve_id, affected_component, 
          port, service, raw_output, ai_analysis
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `, [
        scanId,
        result.vulnerability_type,
        aiAnalysis.risk_level,
        result.title || aiAnalysis.title,
        aiAnalysis.description,
        aiAnalysis.fix_suggestion,
        aiAnalysis.cvss_score,
        result.cve_id,
        result.affected_component,
        result.port,
        result.service,
        JSON.stringify(result.raw_output),
        JSON.stringify(aiAnalysis)
      ])

      processedResults.push({
        id: dbResult.rows[0].id,
        ...result,
        ai_analysis: aiAnalysis
      })
    }

    await job.updateProgress(100)
    return processedResults

  } catch (error) {
    logger.error('Scan execution error:', { scanId, error: error.message })
    throw error
  }
}

const closeQueue = async () => {
  try {
    if (scanWorker) {
      await scanWorker.close()
    }
    await scanQueue.close()
    await redisConnection.quit()
    logger.info('Queue system closed')
  } catch (error) {
    logger.error('Error closing queue system:', error)
  }
}

module.exports = {
  initializeQueue,
  addScanJob,
  getScanJobStatus,
  getQueueStats,
  closeQueue,
  scanQueue
}
