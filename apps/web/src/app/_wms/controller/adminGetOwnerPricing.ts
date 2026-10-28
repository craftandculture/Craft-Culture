import { and, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { wmsOwnerPricing } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getOwnerPricingSchema } from '../schemas/pricingManagerSchema';

/**
 * Get per-owner PC selling prices for a set of LWIN18s
 *
 * Returns a map of lwin18 → pcSellingPricePerBottle for the given owner.
 * Used by the Pricing Manager when an owner filter is active.
 */
const adminGetOwnerPricing = adminProcedure
  .input(getOwnerPricingSchema)
  .query(async ({ input }) => {
    const { lwin18s, ownerId } = input;

    const rows = await db
      .select({
        lwin18: wmsOwnerPricing.lwin18,
        pcSellingPricePerBottle: wmsOwnerPricing.pcSellingPricePerBottle,
      })
      .from(wmsOwnerPricing)
      .where(
        and(
          inArray(wmsOwnerPricing.lwin18, lwin18s),
          eq(wmsOwnerPricing.ownerId, ownerId),
        ),
      );

    const priceMap: Record<string, number> = {};
    for (const row of rows) {
      priceMap[row.lwin18] = row.pcSellingPricePerBottle;
    }

    return { priceMap };
  });

export default adminGetOwnerPricing;
