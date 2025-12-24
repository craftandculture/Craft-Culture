import { z } from 'zod';

const markAsReadSchema = z.object({
  notificationId: z.string().uuid(),
});

export default markAsReadSchema;
