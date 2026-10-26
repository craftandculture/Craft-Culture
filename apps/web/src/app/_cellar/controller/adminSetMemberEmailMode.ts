import { z } from 'zod';

import settingsUpdateController from '@/app/_admin/controllers/settingsUpdateController';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { MEMBER_EMAIL_MODES, MEMBER_EMAIL_MODE_SETTING } from '../data/getMemberEmailMode';

/**
 * Turn member emails off, to the team inbox (shadow), or on to members (live)
 *
 * Emails that fall due while the switch is off are marked suppressed and never
 * sent, so moving it to live never releases a backlog to members.
 */
const adminSetMemberEmailMode = staffAdminProcedure
  .input(z.object({ mode: z.enum(MEMBER_EMAIL_MODES) }))
  .mutation(async ({ ctx, input }) => {
    await settingsUpdateController({ key: MEMBER_EMAIL_MODE_SETTING, value: input.mode });

    logger.info('Member email mode changed', { mode: input.mode, by: ctx.user.email });

    return { mode: input.mode };
  });

export default adminSetMemberEmailMode;
