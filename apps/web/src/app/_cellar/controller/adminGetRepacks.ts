import { z } from 'zod';

import dubaiMonth from '@/app/_onboarding/utils/dubaiMonth';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import { REPACK_PACKAGE_AED } from '../constants/repackFee';
import getMonthlyRepacks from '../data/getMonthlyRepacks';

/**
 * The repacks to add to each member's monthly warehouse services invoice
 *
 * @example
 *   await trpcClient.cellar.admin.getRepacks.query({ month: '2026-10' });
 */
const adminGetRepacks = staffAdminProcedure
  .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }))
  .query(async ({ input }) => {
    const result = await getMonthlyRepacks(input.month ?? dubaiMonth());
    return { ...result, rateAed: REPACK_PACKAGE_AED };
  });

export default adminGetRepacks;
