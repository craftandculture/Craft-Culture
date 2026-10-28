import { z } from 'zod';

import settingsUpdateController from '@/app/_admin/controllers/settingsUpdateController';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import getBottleWordingMode, {
  BOTTLE_WORDING_MODES,
  BOTTLE_WORDING_MODE_SETTING,
} from '../data/getBottleWordingMode';

/**
 * Who sees the cellar in bottles: nobody, staff only, or every member
 */
export const adminGetBottleWordingMode = staffAdminProcedure.query(async () => ({
  mode: await getBottleWordingMode(),
}));

const adminSetBottleWordingMode = staffAdminProcedure
  .input(z.object({ mode: z.enum(BOTTLE_WORDING_MODES) }))
  .mutation(async ({ ctx, input }) => {
    await settingsUpdateController({ key: BOTTLE_WORDING_MODE_SETTING, value: input.mode });

    logger.info('Cellar bottle wording mode changed', { mode: input.mode, by: ctx.user.email });

    return { mode: input.mode };
  });

export default adminSetBottleWordingMode;
