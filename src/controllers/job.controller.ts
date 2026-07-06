import type { Request, Response } from 'express';
import { pool } from '../db/config';
import { createJobSchema } from '../schemas/job.schema';
import { z } from 'zod';

export const submitJob = async (req: Request, res: Response): Promise<void> => {
  const queueName = req.params.queue;

  try {
    const validatedData = createJobSchema.parse(req.body);

    const client = await pool.connect();
    try {
      // Find queue ID
      const queueResult = await client.query('SELECT id FROM queues WHERE name = $1', [queueName]);
      if (queueResult.rows.length === 0) {
        res.status(404).json({ error: { code: 'QUEUE_NOT_FOUND', message: `Queue '${queueName}' not found` } });
        return;
      }

      const queueId = queueResult.rows[0].id;

      // Ensure run_at is parsed safely, or default to NOW
      const runAt = validatedData.run_at ? new Date(validatedData.run_at) : new Date();

      const insertResult = await client.query(
        `INSERT INTO jobs (queue_id, type, payload, priority, max_attempts, run_at, status) 
         VALUES ($1, $2, $3, $4, $5, $6, 'pending') 
         RETURNING id, type, status, priority, max_attempts, run_at, created_at`,
        [
          queueId, 
          validatedData.type, 
          validatedData.payload, 
          validatedData.priority, 
          validatedData.max_attempts, 
          runAt
        ]
      );

      res.status(201).json(insertResult.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.issues } });
      return;
    }

    console.error('Error submitting job:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to submit job' } });
  }
};
