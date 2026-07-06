import { Router } from 'express';
import { createQueue } from '../controllers/queue.controller';
import { submitJob } from '../controllers/job.controller';
import { getMetrics, getQueueJobs, getJobDetails, retryJob } from '../controllers/dashboard.controller';
import { login } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// 🔓 Public Endpoints
router.post('/auth/login', login);

// 🔒 Secure all routes below this line
router.use(requireAuth);

// Queue Endpoints
router.post('/queues', createQueue);
router.post('/queues/:queue/jobs', submitJob);

// Dashboard / Read Endpoints
router.get('/metrics', getMetrics);
router.get('/queues/:queue/jobs', getQueueJobs);
router.get('/jobs/:id', getJobDetails);
router.post('/jobs/:id/retry', retryJob);

export default router;
