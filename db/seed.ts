import { pool } from '../src/db/config';

async function seed() {
  const client = await pool.connect();
  
  try {
    console.log('Seeding database...');
    
    // 1. Create a queue
    const queueRes = await client.query(
      `INSERT INTO queues (name) VALUES ('emails') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`
    );
    const queueId = queueRes.rows[0].id;
    console.log(`Queue 'emails' ensured with ID: ${queueId}`);

    // 2. Insert some pending jobs
    const jobsToInsert = [
      { type: 'welcome_email', payload: { user_id: 1, email: 'alice@example.com' }, priority: 0 },
      { type: 'welcome_email', payload: { user_id: 2, email: 'bob@example.com' }, priority: 0 },
      { type: 'password_reset', payload: { user_id: 3, email: 'charlie@example.com' }, priority: 10 }, // Higher priority (lower number is higher priority typically, but assuming 10 is lower here based on schema default 0. Wait, our schema says "lower = higher priority", so 10 is low priority)
      { type: 'password_reset', payload: { user_id: 4, email: 'diana@example.com' }, priority: -5 }, // Very high priority
    ];

    let inserted = 0;
    for (const job of jobsToInsert) {
      await client.query(
        `INSERT INTO jobs (queue_id, type, payload, priority, max_attempts) 
         VALUES ($1, $2, $3, $4, $5)`,
        [queueId, job.type, job.payload, job.priority, 5]
      );
      inserted++;
    }

    console.log(`Successfully seeded ${inserted} jobs into 'emails' queue.`);
    
  } catch (err) {
    console.error('Error during seeding:', err);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
