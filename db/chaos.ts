import { pool } from '../src/db/config';

async function chaosTest() {
  const client = await pool.connect();
  try {
    console.log('Initiating Chaos Test...');

    // Insert a job that looks like a worker claimed it 10 minutes ago and then crashed
    const res = await client.query(
      `INSERT INTO jobs (queue_id, type, payload, priority, max_attempts, status, locked_by, locked_at)
       VALUES (
         (SELECT id FROM queues WHERE name = 'emails' LIMIT 1),
         'welcome_email',
         '{"user_id": 999, "email": "chaos@example.com"}',
         0, 
         5,
         'running',
         'worker-dead-123',
         NOW() - INTERVAL '10 minutes'
       ) RETURNING id`
    );

    console.log(`Successfully inserted STUCK job with ID: ${res.rows[0].id}`);
    console.log(`The Reaper should rescue this job on its next polling cycle!`);

  } catch (err) {
    console.error('Error during chaos test:', err);
  } finally {
    client.release();
    pool.end();
  }
}

chaosTest();
