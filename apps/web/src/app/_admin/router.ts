import { router } from '@/lib/trpc';
import { adminProcedure } from '@/lib/trpc/procedures';

import activityLogsGetManyController from './controllers/activityLogsGetMany';
import activityLogsGetManyInputSchema from './schemas/activityLogsGetManyInputSchema';

const adminRouter = router({
  activityLogs: router({
    getMany: adminProcedure
      .input(activityLogsGetManyInputSchema)
      .query(async ({ input }) => {
        return await activityLogsGetManyController(input);
      }),
  }),
});

export default adminRouter;
