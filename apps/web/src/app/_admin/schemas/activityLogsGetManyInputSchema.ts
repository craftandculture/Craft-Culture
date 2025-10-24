import { z } from 'zod';

const activityLogsGetManyInputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
  adminId: z.string().uuid().optional(),
  action: z.string().optional(),
});

export default activityLogsGetManyInputSchema;
