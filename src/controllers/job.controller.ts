import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db/config';
import { createJobSchema } from '../schemas/job.schema';
import { z } from 'zod';

export const submitJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      // Backpressure Check: limit to 10,000 pending jobs per queue
      const MAX_QUEUE_DEPTH = 10000;
      const countResult = await client.query(
        "SELECT COUNT(*) FROM jobs WHERE queue_id = $1 AND status = 'pending'",
        [queueId]
      );
      if (parseInt(countResult.rows[0].count, 10) >= MAX_QUEUE_DEPTH) {
        res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message: 'Queue is at maximum capacity. Please try again later.' } });
        return;
      }

      // Ensure run_at is parsed safely, or default to NOW
      const runAt = validatedData.run_at ? new Date(validatedData.run_at) : new Date();

      const insertResult = await client.query(
        `INSERT INTO jobs (queue_id, type, payload, priority, max_attempts, run_at, idempotency_key, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') 
         RETURNING id, type, status, priority, max_attempts, run_at, idempotency_key, created_at`,
        [
          queueId, 
          validatedData.type, 
          validatedData.payload, 
          validatedData.priority, 
          validatedData.max_attempts, 
          runAt,
          validatedData.idempotency_key || null
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

    // Handle Idempotency Key violation (Postgres unique violation)
    if ((error as any).code === '23505' && validatedData.idempotency_key) {
      // Find the existing job
      const existingJobResult = await pool.query(
        'SELECT id, type, status, priority, max_attempts, run_at, idempotency_key, created_at FROM jobs WHERE queue_id = (SELECT id FROM queues WHERE name = $1) AND idempotency_key = $2',
        [queueName, validatedData.idempotency_key]
      );
      if (existingJobResult.rows.length > 0) {
        res.status(200).json(existingJobResult.rows[0]);
        return;
      }
    }

    next(error);
  }
};
