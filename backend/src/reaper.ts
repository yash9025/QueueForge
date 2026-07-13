import { pool } from '../src/db/config';

const POLL_INTERVAL = 60 * 1000; // Run every 60 seconds
const STUCK_TIMEOUT_MINUTES = 5;

async function reapStuckJobs() {
  console.log(`\n[REAPER] 🔎 Scanning for jobs stuck in 'running' for > ${STUCK_TIMEOUT_MINUTES} minutes...`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find and update stuck jobs back to 'pending'
    const res = await client.query(
      `UPDATE jobs 
       SET status = 'pending', 
           locked_by = NULL, 
           locked_at = NULL, 
           updated_at = NOW(),
           last_error = 'Worker crashed or timed out (Reaped)'
       WHERE status = 'running' 
         AND locked_at < NOW() - INTERVAL '${STUCK_TIMEOUT_MINUTES} minutes'
       RETURNING id, locked_by`
    );

    const reapedJobs = res.rows;

    if (reapedJobs.length > 0) {
      console.log(`[REAPER] ⚠️ Found and rescued ${reapedJobs.length} stuck job(s)!`);

      // 2. Log the event for each rescued job
      for (const job of reapedJobs) {
        console.log(`[REAPER] Rescued job ${job.id} (was locked by ${job.locked_by})`);
        await client.query(
          `INSERT INTO job_events (job_id, from_status, to_status, worker_id) VALUES ($1, $2, $3, $4)`,
          [job.id, 'running', 'pending', 'SYSTEM_REAPER']
        );
      }
    } else {
      console.log(`[REAPER] ✅ No stuck jobs found.`);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[REAPER] Error during reaping:`, err);
  } finally {
    client.release();
  }
}

async function startReaper() {
  console.log(`[REAPER] 🚀 Reaper process started. Polling every ${POLL_INTERVAL / 1000}s.`);
  
  // Run immediately once
  await reapStuckJobs();

  // Then loop forever
  setInterval(reapStuckJobs, POLL_INTERVAL);
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log(`\n[REAPER] Shutting down gracefully...`);
  await pool.end();
  process.exit(0);
});

startReaper();
