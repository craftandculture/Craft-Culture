import { z } from 'zod';

const activityLogCreateInputSchema = z.object({
  action: z.string(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export default activityLogCreateInputSchema;
