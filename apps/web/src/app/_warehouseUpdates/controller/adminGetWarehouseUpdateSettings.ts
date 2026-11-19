import { z } from 'zod';

import { staffAdminProcedure } from '@/lib/trpc/procedures';

import getWarehouseUpdateMode from '../data/getWarehouseUpdateMode';
import getWarehouseUpdatePartners from '../data/getWarehouseUpdatePartners';
import getWarehouseUpdateRecipients from '../data/getWarehouseUpdateRecipients';

/**
 * One distributor's warehouse update settings, with who would receive them
 * and the switch they all run under
 */
const adminGetWarehouseUpdateSettings = staffAdminProcedure
  .input(z.object({ partnerId: z.string().uuid() }))
  .query(async ({ input }) => {
    const [mode, partners, recipients] = await Promise.all([
      getWarehouseUpdateMode(),
      getWarehouseUpdatePartners(),
      getWarehouseUpdateRecipients(input.partnerId),
    ]);
    const prefs = partners.get(input.partnerId);

    return {
      mode,
      enabled: !!prefs,
      picked: prefs?.picked ?? 'grouped',
      summary: prefs?.summary ?? true,
      recipients,
    };
  });

export default adminGetWarehouseUpdateSettings;
