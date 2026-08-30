import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { setLineLogisticsSchema } from '../schemas/pricingManagerSchema';
import writeProductPricing from '../utils/writeProductPricing';


/**
 * Upsert a per-line logistics $/btl override for a product by LWIN18.
 *
 * When set, this replaces the owner/global logistics rate in the landed-cost
 * build-up (landed = import + logistics + override) for this SKU only. Passing
 * null clears it so the row reverts to the owner's / global logistics rate.
 *
 * @param lwin18 - The product LWIN18 identifier
 * @param logisticsPerBottle - Per-line logistics $/btl, or null to clear
 */
const adminSetLineLogistics = wmsOperatorProcedure
  .input(setLineLogisticsSchema)
  .mutation(async ({ input, ctx }) => {
    const { lwin18, logisticsPerBottle } = input;

    await writeProductPricing({ lwin18, set: { logisticsPerBottle }, userId: ctx.user.id });

    return { lwin18, logisticsPerBottle };
  });

export default adminSetLineLogistics;
