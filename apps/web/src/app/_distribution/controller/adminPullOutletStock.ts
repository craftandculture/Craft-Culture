import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';

import pullOutletStock from '../data/pullOutletStock';

/**
 * Pull an outlet's stock position now
 *
 * The scheduled job does this daily; this is the button for when someone wants
 * the position as it stands rather than as it stood at two this morning.
 *
 * Daily rather than monthly matters: the feed carries no history and takes no
 * date, so a boundary missed is a month that can only ever come from an upload.
 *
 * @param outletId - The outlet to pull; omit for every API-connected outlet
 * @returns What each pull found, including anything unmatched
 */
const adminPullOutletStock = adminProcedure
  .input(z.object({ outletId: z.string().uuid().optional() }))
  .mutation(async ({ input }) => {
    const { results, notConnected } = await pullOutletStock({ outletId: input.outletId });

    if (notConnected) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: input.outletId
          ? 'That outlet is not connected by API — its position arrives as an upload.'
          : 'No outlet is connected by API yet.',
      });
    }

    return { results };
  });

export default adminPullOutletStock;
