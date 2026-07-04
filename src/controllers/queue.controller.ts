import { Request, Response } from 'express';
import { pool } from '../db/config';
import { createQueueSchema } from '../schemas/queue.schema';
import { z } from 'zod';

export const createQueue = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createQueueSchema.parse(req.body);

    const result = await pool.query(
      'INSERT INTO queues (name) VALUES ($1) RETURNING id, name, created_at',
      [validatedData.name]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors } });
      return;
    }
    
    // Check for PostgreSQL unique constraint violation
    if ((error as any).code === '23505') {
      res.status(400).json({ error: { code: 'DUPLICATE_QUEUE', message: 'Queue with this name already exists' } });
      return;
    }

    console.error('Error creating queue:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create queue' } });
  }
};
