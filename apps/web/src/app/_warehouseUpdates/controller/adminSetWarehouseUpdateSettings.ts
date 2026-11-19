import { z } from 'zod';

import settingsUpdateController from '@/app/_admin/controllers/settingsUpdateController';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { WAREHOUSE_UPDATE_PARTNERS_SETTING } from '../constants';
import getWarehouseUpdatePartners from '../data/getWarehouseUpdatePartners';

/**
 * Switch one distributor's warehouse updates on or off, and set how picked &
 * packed updates and the end-of-day summary reach them
 */
const adminSetWarehouseUpdateSettings = staffAdminProcedure
  .input(
    z.object({
      partnerId: z.string().uuid(),
      enabled: z.boolean(),
      picked: z.enum(['grouped', 'immediate']),
      summary: z.boolean(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const partners = await getWarehouseUpdatePartners();
    if (input.enabled) partners.set(input.partnerId, { picked: input.picked, summary: input.summary });
    else partners.delete(input.partnerId);

    await settingsUpdateController({
      key: WAREHOUSE_UPDATE_PARTNERS_SETTING,
      value: JSON.stringify(Object.fromEntries(partners)),
    });

    logger.info('Warehouse update settings changed', { ...input, by: ctx.user.email });
    return input;
  });

export default adminSetWarehouseUpdateSettings;
