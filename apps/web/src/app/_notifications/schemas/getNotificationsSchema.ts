import { z } from 'zod';

import notificationAreas from '../constants/notificationAreas';

const areaIds = notificationAreas.map((a) => a.id) as [string, ...string[]];

const getNotificationsSchema = z.object({
  limit: z.number().min(1).max(50).default(20),
  cursor: z.number().min(0).default(0),
  unreadOnly: z.boolean().optional().default(false),
  /** Only unread notifications that ask the reader to act */
  actionOnly: z.boolean().optional().default(false),
  /** Only notifications in this area */
  area: z.enum(areaIds).optional(),
});

export default getNotificationsSchema;
