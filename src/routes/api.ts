import { Router } from 'express';
import { createQueue } from '../controllers/queue.controller';
import { submitJob } from '../controllers/job.controller';
import { getMetrics, getQueueJobs, getJobDetails, retryJob } from '../controllers/dashboard.controller';
import { login } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

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

// 🔒 Secure all routes below this line
router.use(requireAuth);

// Queue Endpoints
router.post('/queues', createQueue);
router.post('/queues/:queue/jobs', jobSubmissionLimiter, submitJob);

// Dashboard / Read Endpoints
router.get('/metrics', getMetrics);
router.get('/queues/:queue/jobs', getQueueJobs);
router.get('/jobs/:id', getJobDetails);
router.post('/jobs/:id/retry', retryJob);

export default router;
