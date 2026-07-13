import { Router } from 'express';
import { createQueue } from '../controllers/queue.controller';
import { submitJob } from '../controllers/job.controller';
import { getMetrics, getHistoricalMetrics, getQueueJobs, getJobDetails, retryJob } from '../controllers/dashboard.controller';
import { login } from '../controllers/auth.controller';
import { workerHeartbeat } from '../controllers/worker.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { pool } from '../db/config';

import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter for job submission to prevent spam
const jobSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 job submissions per windowMs
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many jobs submitted from this IP, please try again after 15 minutes' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🔓 Public Endpoints
router.post('/auth/login', login);
router.get('/health/live', (req, res) => { res.status(200).json({ status: 'ok' }); });
router.get('/health/ready', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ready', db: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// 🔒 Secure all routes below this line
router.use(requireAuth);

// Queue Endpoints
router.post('/queues', createQueue);
router.post('/queues/:queue/jobs', jobSubmissionLimiter, submitJob);

// Dashboard / Read Endpoints
router.get('/metrics', getMetrics);
router.get('/metrics/history', getHistoricalMetrics);
router.get('/queues/:queue/jobs', getQueueJobs);
router.get('/jobs/:id', getJobDetails);
router.post('/jobs/:id/retry', retryJob);

// Worker Endpoints
router.post('/workers/heartbeat', workerHeartbeat);

export default router;
