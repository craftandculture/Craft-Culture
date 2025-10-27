import { z } from 'zod';

const userActivityLogsGetManyInputSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
});

export default userActivityLogsGetManyInputSchema;
