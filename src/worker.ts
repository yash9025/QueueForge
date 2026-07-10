import { pool } from '../src/db/config';
import { registry } from './registry';
import { randomUUID } from 'crypto';
import { logger } from './utils/logger';
import { randomUUID } from 'crypto';

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

async function processJob(job: any, client: any) {
  logger.info(`\n[WORKER ${WORKER_ID}] 📦 Claimed job ${job.id} (Type: ${job.type}, Priority: ${job.priority})`);
  
  const handler = registry[job.type];

  if (!handler) {
    logger.error(`[WORKER ${WORKER_ID}] ❌ No handler found for job type: ${job.type}`);
    await failJob(client, job.id, job.attempts, job.max_attempts, 'No handler registered');
    return;
  }

  try {
    // 1. Execute the actual handler logic
    await handler(job.payload);
    
    // 2. Mark as completed on success
    await client.query(
      `UPDATE jobs SET status = 'completed', updated_at = NOW(), locked_by = NULL, locked_at = NULL WHERE id = $1`,
      [job.id]
    );

    await client.query(
      `INSERT INTO job_events (job_id, from_status, to_status, worker_id) VALUES ($1, $2, $3, $4)`,
      [job.id, 'running', 'completed', WORKER_ID]
    );

  } catch (error: any) {
    logger.error(`[WORKER ${WORKER_ID}] ❌ Job ${job.id} failed:`, error.message);
    await failJob(client, job.id, job.attempts, job.max_attempts, error.message);
  }
}

async function failJob(client: any, jobId: string, currentAttempts: number, maxAttempts: number, errorMessage: string) {
  const newAttempts = currentAttempts + 1;
  const isDeadLetter = newAttempts >= maxAttempts;
  const nextStatus = isDeadLetter ? 'dead_letter' : 'pending';
  
  // Calculate next run_at for exponential backoff if it's going back to pending
  let runAtSql = `NOW()`;
  if (!isDeadLetter) {
    const delaySeconds = calculateBackoffSeconds(newAttempts);
    runAtSql = `NOW() + interval '${delaySeconds} seconds'`;
    logger.info(`[WORKER ${WORKER_ID}] ⏳ Requeueing job ${jobId} (Attempt ${newAttempts}/${maxAttempts}). Will retry in ${delaySeconds}s.`);
  } else {
    logger.error(`[WORKER ${WORKER_ID}] 💀 Job ${jobId} reached max attempts (${maxAttempts}). Moving to DLQ.`);
  }

  await client.query(
    `UPDATE jobs 
     SET status = $1, attempts = $2, last_error = $3, run_at = ${runAtSql}, updated_at = NOW(), locked_by = NULL, locked_at = NULL 
     WHERE id = $4`,
    [nextStatus, newAttempts, errorMessage, jobId]
  );

  await client.query(
    `INSERT INTO job_events (job_id, from_status, to_status, worker_id) VALUES ($1, $2, $3, $4)`,
    [jobId, 'running', nextStatus, WORKER_ID]
  );
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
      logger.error(`[WORKER ${WORKER_ID}] Failed to send heartbeat`, err);
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
        
        // Process jobs concurrently in this batch
        await Promise.all(jobs.map(job => processJob(job, client)));
      } else {
        await client.query('COMMIT');
      }

    } catch (err) {
      await client.query('ROLLBACK');
      logger.error(`[WORKER ${WORKER_ID}] Error in poll loop:`, err);
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
