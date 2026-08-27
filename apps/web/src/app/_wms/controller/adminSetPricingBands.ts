import { eq, isNull } from 'drizzle-orm';

import db from '@/database/client';
import { wmsPricingBands } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { setPricingBandsSchema } from '../schemas/pricingBandSchema';

/**
 * Replace a set of margin tiers in one go.
 *
 * The whole set is written together — anything the caller leaves out is
 * removed — so what is saved is exactly what was on screen. Editing tiers
 * one row at a time would let a half-saved set price wine from a gap.
 *
 * Bands may overlap; the narrower one wins when a wine falls in both, matching
 * resolvePricingMargins. A wine below every band falls back to the owner's flat
 * rate, then 10%.
 *
 * @example
 *   await trpcClient.wms.admin.stock.pricing.setBands.mutate({
 *     ownerId: null,
 *     bands: [{ ownerId: null, minLandedPerBottle: 0, maxLandedPerBottle: 50, b2bMarginPct: 30, pcMarginPct: 45 }],
 *   });
 */
const adminSetPricingBands = wmsOperatorProcedure
  .input(setPricingBandsSchema)
  .mutation(async ({ input, ctx }) => {
    const { ownerId, bands } = input;

    return db.transaction(async (tx) => {
      await tx
        .delete(wmsPricingBands)
        .where(
          ownerId
            ? eq(wmsPricingBands.ownerId, ownerId)
            : isNull(wmsPricingBands.ownerId),
        );

      if (bands.length > 0) {
        await tx.insert(wmsPricingBands).values(
          bands.map((band) => ({
            ownerId,
            minLandedPerBottle: band.minLandedPerBottle,
            maxLandedPerBottle: band.maxLandedPerBottle,
            b2bMarginPct: band.b2bMarginPct,
            pcMarginPct: band.pcMarginPct,
            updatedBy: ctx.user.id,
          })),
        );
      }

      return { ownerId, saved: bands.length };
    });
  });

export default adminSetPricingBands;
