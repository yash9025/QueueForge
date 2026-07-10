import { pool } from '../src/db/config';
import { registry } from './registry';
import { randomUUID } from 'crypto';
import { logger } from './utils/logger';

const WORKER_ID = `worker-${randomUUID()}`;
const POLL_INTERVAL = 2000; // 2 seconds
const BATCH_SIZE = 5;

let isShuttingDown = false;

// Helper to calculate exponential backoff delay (in minutes for this example, or seconds for testing)
// Let's use seconds so we don't have to wait hours to test retries!
const calculateBackoffSeconds = (attempts: number) => {
  const baseDelay = 5; // 5 seconds
  return baseDelay * Math.pow(2, attempts); // 5s, 10s, 20s, 40s...
};

// Each job gets its own dedicated connection from the pool for its write-back.
// This isolates jobs from each other — one job's failure cannot roll back
// another job's completed status. The claiming client is released after COMMIT.
async function processJob(job: any) {
  logger.info(`[WORKER ${WORKER_ID}] 📦 Claimed job ${job.id} (type: ${job.type}, priority: ${job.priority})`);

  const handler = registry[job.type];

  if (!handler) {
    logger.error(`[WORKER ${WORKER_ID}] ❌ No handler for job type "${job.type}" — moving to DLQ`);
    await failJob(job.id, job.attempts, job.max_attempts, 'No handler registered for this job type');
    return;
  }

  try {
    // Run the actual business logic
    await handler(job.payload);

    // Write success back to the DB on its own connection
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE jobs
         SET status = 'completed', locked_by = NULL, locked_at = NULL
         WHERE id = $1`,
        [job.id]
      );
      await client.query(
        `INSERT INTO job_events (job_id, from_status, to_status, worker_id)
         VALUES ($1, 'running', 'completed', $2)`,
        [job.id, WORKER_ID]
      );
      logger.info(`[WORKER ${WORKER_ID}] ✅ Job ${job.id} completed`);
    } finally {
      client.release();
    }

  } catch (error: any) {
    logger.error(`[WORKER ${WORKER_ID}] ❌ Job ${job.id} failed: ${error.message}`);
    await failJob(job.id, job.attempts, job.max_attempts, error.message);
  }
}

// Handles both retry-with-backoff and dead-letter promotion.
// Uses its own pool connection so it is fully independent of processJob.
async function failJob(jobId: string, currentAttempts: number, maxAttempts: number, errorMessage: string) {
  const newAttempts = currentAttempts + 1;
  const isDeadLetter = newAttempts >= maxAttempts;
  const nextStatus = isDeadLetter ? 'dead_letter' : 'pending';

  // Build the backoff interval inline; safe because delaySeconds is an integer
  // computed internally — never from user input.
  let runAtExpression = 'NOW()';
  if (!isDeadLetter) {
    const delaySeconds = calculateBackoffSeconds(newAttempts);
    runAtExpression = `NOW() + interval '${delaySeconds} seconds'`;
    logger.info(`[WORKER ${WORKER_ID}] ⏳ Requeueing ${jobId} (attempt ${newAttempts}/${maxAttempts}) — retry in ${delaySeconds}s`);
  } else {
    logger.error(`[WORKER ${WORKER_ID}] 💀 Job ${jobId} exhausted ${maxAttempts} attempts — moving to DLQ`);
  }

  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE jobs
       SET status     = $1,
           attempts   = $2,
           last_error = $3,
           run_at     = ${runAtExpression},
           locked_by  = NULL,
           locked_at  = NULL
       WHERE id = $4`,
      [nextStatus, newAttempts, errorMessage, jobId]
    );
    await client.query(
      `INSERT INTO job_events (job_id, from_status, to_status, worker_id)
       VALUES ($1, 'running', $2, $3)`,
      [jobId, nextStatus, WORKER_ID]
    );
  } finally {
    client.release();
  }
}


async function startWorker() {
  logger.info(`[WORKER ${WORKER_ID}] 🚀 Starting worker. Polling every ${POLL_INTERVAL}ms...`);

  // Heartbeat loop (runs in background)
  const heartbeatInterval = setInterval(async () => {
    try {
      await pool.query(
        `INSERT INTO workers (id, status, last_heartbeat) 
         VALUES ($1, 'online', NOW()) 
         ON CONFLICT (id) DO UPDATE SET last_heartbeat = NOW()`,
        [WORKER_ID]
      );
    } catch (err) {
      logger.error({ err }, `[WORKER ${WORKER_ID}] Failed to send heartbeat`);
    }
  }, 5000);

  // Main Polling Loop
  while (!isShuttingDown) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // The core claiming query using SKIP LOCKED
      // Orders by priority (lowest number first), then run_at (oldest first)
      const res = await client.query(
        `UPDATE jobs 
         SET status = 'running', locked_by = $1, locked_at = NOW(), updated_at = NOW()
         WHERE id IN (
             SELECT id FROM jobs 
             WHERE status = 'pending' AND run_at <= NOW()
             ORDER BY priority ASC, run_at ASC
             LIMIT $2
             FOR UPDATE SKIP LOCKED
         )
         RETURNING *`,
        [WORKER_ID, BATCH_SIZE]
      );

      const jobs = res.rows;

      if (jobs.length > 0) {
        // Log state transition to 'running'
        for (const job of jobs) {
           await client.query(
            `INSERT INTO job_events (job_id, from_status, to_status, worker_id) VALUES ($1, $2, $3, $4)`,
            [job.id, 'pending', 'running', WORKER_ID]
          );
        }
        
        await client.query('COMMIT');
        
        // Run all jobs in this batch concurrently. Each job manages
        // its own pool connection internally, so they are fully isolated.
        await Promise.all(jobs.map(job => processJob(job)));
      } else {
        await client.query('COMMIT');
      }

    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ err }, `[WORKER ${WORKER_ID}] Error in poll loop:`);
    } finally {
      client.release();
    }

    // Wait before polling again to avoid hammering the DB when empty
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }

  logger.info(`[WORKER ${WORKER_ID}] Graceful exit: no more jobs in flight. Cleaning up...`);
  clearInterval(heartbeatInterval);
  await pool.query(`UPDATE workers SET status = 'offline' WHERE id = $1`, [WORKER_ID]);
  await pool.end();
  process.exit(0);
}

// Graceful shutdown handling
const handleShutdown = () => {
  if (isShuttingDown) return;
  logger.info(`\n[WORKER ${WORKER_ID}] 🛑 Received shutdown signal. Waiting for in-flight jobs to finish...`);
  isShuttingDown = true;

  // Hard timeout: force exit if jobs take too long to finish
  setTimeout(() => {
    logger.error(`[WORKER ${WORKER_ID}] 💥 Force quitting after 30s timeout.`);
    process.exit(1);
  }, 30000).unref();
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

startWorker();
