import { adminProcedure, protectedProcedure, publicProcedure } from '@/lib/trpc/procedures';
import { createTRPCRouter } from '@/lib/trpc/trpc';

import activityLogCreate from './controllers/activityLogCreate';
import activityLogsGetManyController from './controllers/activityLogsGetMany';
import localInventorySheetUpdate from './controllers/localInventorySheetUpdate';
import settingsGetController from './controllers/settingsGetController';
import settingsUpdateController from './controllers/settingsUpdateController';
import userActivityLogsGetManyController from './controllers/userActivityLogsGetMany';
import userActivityLogsMarkAsViewed from './controllers/userActivityLogsMarkAsViewed';
import activityLogCreateInputSchema from './schemas/activityLogCreateInputSchema';
import activityLogsGetManyInputSchema from './schemas/activityLogsGetManyInputSchema';
import settingsGetInputSchema from './schemas/settingsGetInputSchema';
import settingsUpdateInputSchema from './schemas/settingsUpdateInputSchema';
import updateLocalInventorySheetSchema from './schemas/updateLocalInventorySheetSchema';
import userActivityLogsGetManyInputSchema from './schemas/userActivityLogsGetManyInputSchema';

const activityLogsRouter = createTRPCRouter({
  getMany: adminProcedure
    .input(activityLogsGetManyInputSchema)
    .query(async ({ input }) => {
      return await activityLogsGetManyController(input);
    }),
});

const userActivityLogsRouter = createTRPCRouter({
  getMany: adminProcedure
    .input(userActivityLogsGetManyInputSchema)
    .query(async ({ input }) => {
      return await userActivityLogsGetManyController(input);
    }),
  create: protectedProcedure
    .input(activityLogCreateInputSchema)
    .mutation(async ({ input }) => {
      return await activityLogCreate(input);
    }),
  markAsViewed: adminProcedure.mutation(async () => {
    return await userActivityLogsMarkAsViewed();
  }),
});

const settingsRouter = createTRPCRouter({
  get: publicProcedure
    .input(settingsGetInputSchema)
    .query(async ({ input }) => {
      return await settingsGetController(input);
    }),
  update: adminProcedure
    .input(settingsUpdateInputSchema)
    .mutation(async ({ input }) => {
      return await settingsUpdateController(input);
    }),
});

const localInventorySheetRouter = createTRPCRouter({
  update: adminProcedure
    .input(updateLocalInventorySheetSchema)
    .mutation(async ({ input }) => {
      return await localInventorySheetUpdate(input);
    }),
  get: adminProcedure.query(async () => {
    const sheetId = await settingsGetController({
      key: 'localInventorySheetId',
    });
    const sheetName = await settingsGetController({
      key: 'localInventorySheetName',
    });
    const lastSync = await settingsGetController({
      key: 'localInventoryLastSync',
    });
    return {
      googleSheetId: sheetId,
      sheetName,
      lastSync,
    };
  }),
});

const adminRouter = createTRPCRouter({
  activityLogs: activityLogsRouter,
  userActivityLogs: userActivityLogsRouter,
  settings: settingsRouter,
  localInventorySheet: localInventorySheetRouter,
});

export default adminRouter;
