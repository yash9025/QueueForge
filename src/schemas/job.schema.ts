import { z } from 'zod';

export const createJobSchema = z.object({
  type: z.string().min(1, "Job type is required").max(100, "Job type is too long"),
  payload: z.any().optional().default({}),
  priority: z.number().int().min(0).max(9999).optional().default(0),
  run_at: z.string().datetime().optional(), // Must be a valid ISO 8601 string if provided
  max_attempts: z.number().int().min(1).max(50).optional().default(5),
  idempotency_key: z.string().max(255, "Idempotency key is too long").optional(),
});

export type CreateJobDto = z.infer<typeof createJobSchema>;
