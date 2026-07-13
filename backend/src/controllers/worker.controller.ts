import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db/config';

export const workerHeartbeat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { worker_id } = req.body;
    if (!worker_id) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'worker_id is required' } });
    }

    await pool.query(
      `INSERT INTO workers (id, status, last_heartbeat) 
       VALUES ($1, 'online', NOW()) 
       ON CONFLICT (id) DO UPDATE SET last_heartbeat = NOW()`,
      [worker_id]
    );

    res.status(200).json({ status: 'ok', worker_id });
  } catch (error) {
    next(error);
  }
};
