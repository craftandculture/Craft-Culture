import { asc, eq, isNull } from 'drizzle-orm';

import db from '@/database/client';
import { wmsPricingBands } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { getPricingBandsSchema } from '../schemas/pricingBandSchema';

/**
 * The margin tiers: what to charge over landed cost, by what the wine cost.
 *
 * Returns the house bands (owner_id null) unless an owner is named, in which
 * case that owner's own bands come back — the set the Pricing Manager edits.
 *
 * @example
 *   await trpcClient.wms.admin.stock.pricing.getBands.query({});
 *   // [{ minLandedPerBottle: 0, maxLandedPerBottle: 50, b2bMarginPct: 30, pcMarginPct: 45 }, …]
 */
const adminGetPricingBands = wmsOperatorProcedure
  .input(getPricingBandsSchema)
  .query(async ({ input }) => {
    const ownerId = input?.ownerId ?? null;

    const bands = await db
      .select()
      .from(wmsPricingBands)
      .where(
        ownerId
          ? eq(wmsPricingBands.ownerId, ownerId)
          : isNull(wmsPricingBands.ownerId),
      )
      .orderBy(asc(wmsPricingBands.minLandedPerBottle));

    return { ownerId, bands };
  });

export default adminGetPricingBands;
