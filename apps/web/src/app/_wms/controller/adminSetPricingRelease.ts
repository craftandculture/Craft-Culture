import { inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsProductPricing } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

/**
 * Release wines to the price lists, or pull them back off.
 *
 * Nothing reaches a customer-facing surface until this is set: stock used to be
 * listed the moment logistics booked it in, before freight was allocated or a
 * margin agreed, which published a price barely above the buy price and then
 * moved it once the real costs arrived.
 *
 * Releasing is deliberately an act, not a side effect of arriving.
 *
 * @example
 *   await trpcClient.wms.admin.stock.pricing.setRelease.mutate({
 *     lwin18s: ['1014525-2019-06-00750'], released: true,
 *   });
 */
const adminSetPricingRelease = wmsOperatorProcedure
  .input(
    z.object({
      lwin18s: z.array(z.string()).min(1).max(500),
      released: z.boolean(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { lwin18s, released } = input;

    // A wine with no pricing row yet has nothing to release — create one so the
    // release is recorded rather than silently dropped.
    if (released) {
      await db
        .insert(wmsProductPricing)
        .values(
          lwin18s.map((lwin18) => ({
            lwin18,
            importPricePerBottle: 0,
            pricingReleasedAt: new Date(),
            pricingReleasedBy: ctx.user.id,
          })),
        )
        .onConflictDoUpdate({
          target: wmsProductPricing.lwin18,
          set: {
            pricingReleasedAt: new Date(),
            pricingReleasedBy: ctx.user.id,
            updatedAt: new Date(),
          },
        });
    } else {
      await db
        .update(wmsProductPricing)
        .set({
          pricingReleasedAt: null,
          pricingReleasedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(inArray(wmsProductPricing.lwin18, lwin18s));
    }

    const [count] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(wmsProductPricing)
      .where(inArray(wmsProductPricing.lwin18, lwin18s));

    return { released, count: lwin18s.length, touched: count?.n ?? 0 };
  });

export default adminSetPricingRelease;
