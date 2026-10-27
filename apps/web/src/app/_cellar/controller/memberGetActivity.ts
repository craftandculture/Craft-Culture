import { z } from 'zod';

import getStockActivity from '@/app/_partners/data/getStockActivity';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

/**
 * Everything that has happened to a member's wine, newest first
 *
 * The same timeline the wine partner portal shows, in a collector's terms:
 * arrivals, deliveries, sales (with the buyer, which a member may see),
 * samples, damage in our care and ownership changes. Warehouse handling is
 * included for the feed to fold away, so nothing is hidden and nothing
 * crowds the page.
 *
 * @example
 *   await trpcClient.cellar.member.getActivity.query({ limit: 100 });
 */
const memberGetActivity = stockOwnerProcedure
  .input(z.object({ limit: z.number().min(1).max(300).default(120) }))
  .query(async ({ input, ctx }) => ({
    entries: await getStockActivity({
      partnerId: ctx.partner.id,
      isCollector: ctx.partner.type === 'private_collector',
      limit: input.limit,
    }),
  }));

export default memberGetActivity;
