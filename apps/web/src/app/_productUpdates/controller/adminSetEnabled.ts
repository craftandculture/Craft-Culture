import { z } from 'zod';

import settingsUpdateController from '@/app/_admin/controllers/settingsUpdateController';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import { WHATS_NEW_SETTING } from '../data/isWhatsNewEnabled';

/** Show or hide What's New in the Private Cellar menu */
const adminSetEnabled = staffAdminProcedure
  .input(z.object({ enabled: z.boolean() }))
  .mutation(async ({ input }) => {
    await settingsUpdateController({ key: WHATS_NEW_SETTING, value: input.enabled ? 'true' : 'false' });

    return { enabled: input.enabled };
  });

export default adminSetEnabled;
