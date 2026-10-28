import { adminProcedure } from '@/lib/trpc/procedures';

import getTeamBoard from '../data/getTeamBoard';

/**
 * The logistics board at a glance, for the top of the Logistics dashboard
 */
const adminGetTeamBoard = adminProcedure.query(async ({ ctx }) => ({
  viewerId: ctx.user.id,
  ...(await getTeamBoard()),
}));

export default adminGetTeamBoard;
