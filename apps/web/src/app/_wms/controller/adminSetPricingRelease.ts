import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsPricingReleases } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import hasPricingReleases from '../utils/hasPricingReleases';
import pakKeyOf from '../utils/pakKeyOf';

/**
 * Release an owner's holding of a wine to the price lists, or pull it back off.
 *
 * Nothing reaches a customer-facing surface until this is set: stock used to be
 * listed the moment logistics booked it in, before freight was allocated or a
 * margin agreed, which published a price barely above the buy price and then
 * moved it once the real costs arrived.
 *
 * Releasing is deliberately an act, not a side effect of arriving — and it is
 * an act about ONE owner's wine. The flag used to live on the pricing row,
 * which is keyed on the wine alone, so releasing Anne Gros released every
 * holding of Anne Gros: a client's consignment was published because C&C had
 * released its own stock of the same wine, and no screen connected the two.
 *
 * Keyed pack-agnostically, as prices are. Releasing a wine releases the wine,
 * not one pack of it.
 *
 * @example
 *   await trpcClient.wms.admin.stock.pricing.setRelease.mutate({
 *     lwin18s: ['1014525-2019-06-00750'], ownerId, released: true,
 *   });
 */
const adminSetPricingRelease = wmsOperatorProcedure
  .input(
    z.object({
      lwin18s: z.array(z.string()).min(1).max(500),
      /** Whose holding is being released — a release is never global */
      ownerId: z.string().uuid(),
      released: z.boolean(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { lwin18s, ownerId, released } = input;

    // Creates the table on first use if a deploy shipped without its migration
    await hasPricingReleases();

    const keys = [...new Set(lwin18s.map(pakKeyOf))].filter(Boolean);

    if (keys.length === 0) {
      return { released, count: lwin18s.length, touched: 0 };
    }

    if (released) {
      const rows = await db
        .insert(wmsPricingReleases)
        .values(
          keys.map((lwinKey) => ({
            lwinKey,
            ownerId,
            releasedAt: new Date(),
            releasedBy: ctx.user.id,
          })),
        )
        .onConflictDoUpdate({
          target: [wmsPricingReleases.lwinKey, wmsPricingReleases.ownerId],
          set: {
            releasedAt: new Date(),
            releasedBy: ctx.user.id,
            updatedAt: new Date(),
          },
        })
        .returning({ lwinKey: wmsPricingReleases.lwinKey });

      return { released, count: lwin18s.length, touched: rows.length };
    }

    const removed = await db
      .delete(wmsPricingReleases)
      .where(
        and(
          eq(wmsPricingReleases.ownerId, ownerId),
          inArray(wmsPricingReleases.lwinKey, keys),
        ),
      )
      .returning({ lwinKey: wmsPricingReleases.lwinKey });

    return { released, count: lwin18s.length, touched: removed.length };
  });

export default adminSetPricingRelease;
