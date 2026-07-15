import { client } from '@/database/client';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { setLineLogisticsSchema } from '../schemas/pricingManagerSchema';

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

    await client`
      INSERT INTO wms_product_pricing (lwin18, import_price_per_bottle, logistics_per_bottle, updated_by)
      VALUES (${lwin18}, 0, ${logisticsPerBottle}, ${ctx.user.id})
      ON CONFLICT (lwin18) DO UPDATE SET
        logistics_per_bottle = ${logisticsPerBottle},
        updated_by = ${ctx.user.id},
        updated_at = NOW()
    `;

    return { lwin18, logisticsPerBottle };
  });

export default adminSetLineLogistics;
