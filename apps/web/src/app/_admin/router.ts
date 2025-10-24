import { adminProcedure } from '@/lib/trpc/procedures';
import { createTRPCRouter } from '@/lib/trpc/trpc';

import activityLogsGetManyController from './controllers/activityLogsGetMany';
import activityLogsGetManyInputSchema from './schemas/activityLogsGetManyInputSchema';

const adminRouter = createTRPCRouter({
  activityLogs: createTRPCRouter({
    getMany: adminProcedure
      .input(activityLogsGetManyInputSchema)
      .query(async ({ input }) => {
        return await activityLogsGetManyController(input);
      }),
  }),
});

export default adminRouter;
