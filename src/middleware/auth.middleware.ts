import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { pool } from '../db/config';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key';

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string;
  const queueName = req.params.queue;

  // 1. API Key Auth (for job submission/workers scoped to a queue)
  if (apiKey) {
    if (!queueName) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'API key auth requires a queue name in the path' } });
      return;
    }
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    try {
      const result = await pool.query(
        `SELECT k.id FROM api_keys k 
         JOIN queues q ON k.queue_id = q.id 
         WHERE k.key_hash = $1 AND q.name = $2`,
        [keyHash, queueName]
      );
      if (result.rows.length > 0) {
        next();
        return;
      }
    } catch (err) {
      next(err);
      return;
    }
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API Key for this queue' } });
    return;
  }

  // 2. JWT Auth (Admin Dashboard)
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' } });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token missing' } });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Attach the user payload to the request (casting as any to bypass strict typing for now)
    (req as any).user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
};
