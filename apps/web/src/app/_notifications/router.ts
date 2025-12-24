import { createTRPCRouter } from '@/lib/trpc/trpc';

import notificationsGetMany from './controller/notificationsGetMany';
import notificationsGetUnreadCount from './controller/notificationsGetUnreadCount';
import notificationsMarkAllAsRead from './controller/notificationsMarkAllAsRead';
import notificationsMarkAsRead from './controller/notificationsMarkAsRead';

const notificationsRouter = createTRPCRouter({
  getMany: notificationsGetMany,
  getUnreadCount: notificationsGetUnreadCount,
  markAsRead: notificationsMarkAsRead,
  markAllAsRead: notificationsMarkAllAsRead,
});

export default notificationsRouter;
