import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminActivityLogsGetMany from './controller/adminActivityLogsGetMany';

const adminRouter = createTRPCRouter({
  activityLogs: createTRPCRouter({
    getMany: adminActivityLogsGetMany,
  }),
});

export default adminRouter;
