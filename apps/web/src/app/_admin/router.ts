import { TRPCError } from '@trpc/server';

import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';
import {
  adminProcedure,
  approvedProcedure,
  protectedProcedure,
} from '@/lib/trpc/procedures';
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

/** Settings any approved account may read (shown on product and quote screens) */
const PUBLIC_SETTING_KEYS = new Set(['leadTimeMin', 'leadTimeMax']);

/**
 * Settings the generic update endpoint may write. Everything else (member
 * email mode, What's New, the UAE arrival rate card, sheet sync state) is
 * owned by a dedicated controller with its own checks and must go through it.
 */
const EDITABLE_SETTING_KEYS = new Set(['leadTimeMin', 'leadTimeMax']);

const settingsRouter = createTRPCRouter({
  get: approvedProcedure
    .input(settingsGetInputSchema)
    .query(async ({ ctx, input }) => {
      if (!PUBLIC_SETTING_KEYS.has(input.key) && !isTeamMember(ctx.user)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return await settingsGetController(input);
    }),
  update: adminProcedure
    .input(settingsUpdateInputSchema)
    .mutation(async ({ input }) => {
      if (!EDITABLE_SETTING_KEYS.has(input.key)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This setting is managed from its own screen.',
        });
      }
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
