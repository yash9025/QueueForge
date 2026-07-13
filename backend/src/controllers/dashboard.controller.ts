import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db/config';

export const getMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const jobStats = await pool.query(`
      SELECT 
        q.name as queue_name,
        j.status,
        COUNT(*) as count
      FROM jobs j
      JOIN queues q ON j.queue_id = q.id
      GROUP BY q.name, j.status
    `);

    const workerStats = await pool.query(`
      SELECT COUNT(*) as active_workers 
      FROM workers 
      WHERE status = 'online' AND last_heartbeat > NOW() - INTERVAL '2 minutes'
    `);

    res.status(200).json({
      jobs: jobStats.rows,
      active_workers: parseInt(workerStats.rows[0].active_workers, 10)
    });
  } catch (error) {
    next(error);
  }
};

export const getHistoricalMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 30 minute timeframe by default
    const timeframeMinutes = parseInt(req.query.timeframe as string || '30', 10);
    
    // Get minute-by-minute breakdown of job completions and failures
    const historyResult = await pool.query(`
      SELECT 
        date_trunc('minute', created_at) as timestamp,
        to_status as status,
        COUNT(*) as count
      FROM job_events
      WHERE created_at > NOW() - INTERVAL '1 minute' * $1
      AND to_status IN ('completed', 'dead_letter')
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `, [timeframeMinutes]);

    // Format the data for Recharts:
    // [{ time: "10:00", completed: 5, dead_letter: 0 }, ...]
    const metricsMap = new Map<string, { time: string, completed: number, dead_letter: number }>();

    historyResult.rows.forEach(row => {
      // row.timestamp is a Date object (pg parses it)
      const d = new Date(row.timestamp);
      // Format as HH:MM for chart labels
      const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      
      if (!metricsMap.has(timeStr)) {
        metricsMap.set(timeStr, { time: timeStr, completed: 0, dead_letter: 0 });
      }
      
      const point = metricsMap.get(timeStr)!;
      if (row.status === 'completed') point.completed = parseInt(row.count, 10);
      if (row.status === 'dead_letter') point.dead_letter = parseInt(row.count, 10);
    });

    res.status(200).json(Array.from(metricsMap.values()));
  } catch (error) {
    next(error);
  }
};

export const getQueueJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const queueName = req.params.queue;
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '50', 10)));
    const offset = (page - 1) * limit;
    
    // Optional status filter
    const statusFilter = req.query.status as string;
    
    let query = `
      SELECT j.id, j.type, j.status, j.attempts, j.max_attempts, j.priority, j.run_at, j.created_at 
      FROM jobs j
      JOIN queues q ON j.queue_id = q.id
      WHERE q.name = $1
    `;
    const queryParams: any[] = [queueName];
    
    if (statusFilter) {
      queryParams.push(statusFilter);
      query += ` AND j.status = $${queryParams.length}`;
    }

    query += ` ORDER BY j.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);
    
    // Get total count for pagination metadata
    let countQuery = `SELECT COUNT(*) FROM jobs j JOIN queues q ON j.queue_id = q.id WHERE q.name = $1`;
    const countParams: any[] = [queueName];
    if (statusFilter) {
      countParams.push(statusFilter);
      countQuery += ` AND j.status = $2`;
    }
    const countResult = await pool.query(countQuery, countParams);
    const totalItems = parseInt(countResult.rows[0].count, 10);

    res.status(200).json({
      data: result.rows,
      meta: {
        page,
        limit,
        total_items: totalItems,
        total_pages: Math.ceil(totalItems / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getJobDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const jobId = req.params.id;

    const jobResult = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
    if (jobResult.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
      return;
    }

    const eventsResult = await pool.query(`SELECT * FROM job_events WHERE job_id = $1 ORDER BY created_at DESC`, [jobId]);

    res.status(200).json({
      ...jobResult.rows[0],
      events: eventsResult.rows
    });
  } catch (error) {
    next(error);
  }
};

export const retryJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const jobId = req.params.id;

    // Only allow retrying jobs that are dead_letter or failed
    const result = await pool.query(`
      UPDATE jobs 
      SET status = 'pending', attempts = 0, last_error = NULL, run_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status IN ('dead_letter', 'failed')
      RETURNING id, status
    `, [jobId]);

    if (result.rows.length === 0) {
      res.status(400).json({ error: { code: 'INVALID_STATE', message: 'Job not found or not in a retryable state (must be dead_letter or failed)' } });
      return;
    }

    await pool.query(
      `INSERT INTO job_events (job_id, from_status, to_status, worker_id) VALUES ($1, $2, $3, $4)`,
      [jobId, 'dead_letter', 'pending', 'API_USER']
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};
