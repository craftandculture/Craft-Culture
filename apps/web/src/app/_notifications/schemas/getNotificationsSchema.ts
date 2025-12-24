import { z } from 'zod';

const getNotificationsSchema = z.object({
  limit: z.number().min(1).max(50).default(20),
  cursor: z.number().min(0).default(0),
  unreadOnly: z.boolean().optional().default(false),
});

export default getNotificationsSchema;
