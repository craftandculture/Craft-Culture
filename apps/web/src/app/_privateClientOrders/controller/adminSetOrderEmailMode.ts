import { z } from 'zod';

import settingsUpdateController from '@/app/_admin/controllers/settingsUpdateController';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { ORDER_EMAIL_MODES, ORDER_EMAIL_MODE_SETTING } from '../data/getOrderEmailMode';

/**
 * Turn the new order emails off, to Kevin's inbox (shadow), or on (live)
 *
 * Live also stops the older per-event emails to partners and distributors, so
 * nobody receives both; moving back to off or shadow restores them.
 */
const adminSetOrderEmailMode = staffAdminProcedure
  .input(z.object({ mode: z.enum(ORDER_EMAIL_MODES) }))
  .mutation(async ({ ctx, input }) => {
    await settingsUpdateController({ key: ORDER_EMAIL_MODE_SETTING, value: input.mode });

    logger.info('Order email mode changed', { mode: input.mode, by: ctx.user.email });

    return { mode: input.mode };
  });

export default adminSetOrderEmailMode;
