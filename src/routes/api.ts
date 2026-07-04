import { Router } from 'express';
import { createQueue } from '../controllers/queue.controller';
import { submitJob } from '../controllers/job.controller';

const router = Router();

// Queue Endpoints
router.post('/queues', createQueue);
router.post('/queues/:queue/jobs', submitJob);

export default router;
