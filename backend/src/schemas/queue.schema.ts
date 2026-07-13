import { z } from 'zod';

export const createQueueSchema = z.object({
  name: z.string()
    .min(1, "Queue name is required")
    .max(50, "Queue name cannot exceed 50 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Queue name can only contain letters, numbers, underscores, and dashes"),
});

export type CreateQueueDto = z.infer<typeof createQueueSchema>;
