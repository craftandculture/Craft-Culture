import { client } from '@/database/client';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { setOwnerPricingSchema } from '../schemas/pricingManagerSchema';

/**
 * Upsert a per-owner PC selling price for a product
 *
 * Each stock owner (e.g. Crurated, Cru Wine) can have a different
 * private client selling price for the same LWIN18 product.
 *
 * @param lwin18 - The product LWIN18 identifier
 * @param ownerId - The partner/owner UUID
 * @param pcSellingPricePerBottle - PC selling price per bottle in USD
 */
const adminSetOwnerPricing = wmsOperatorProcedure
  .input(setOwnerPricingSchema)
  .mutation(async ({ input, ctx }) => {
    const { lwin18, ownerId, pcSellingPricePerBottle } = input;

    await client`
      INSERT INTO wms_owner_pricing (lwin18, owner_id, pc_selling_price_per_bottle, updated_by)
      VALUES (${lwin18}, ${ownerId}, ${pcSellingPricePerBottle}, ${ctx.user.id})
      ON CONFLICT (lwin18, owner_id) DO UPDATE SET
        pc_selling_price_per_bottle = ${pcSellingPricePerBottle},
        updated_by = ${ctx.user.id},
        updated_at = NOW()
    `;

    return { lwin18, ownerId, pcSellingPricePerBottle };
  });

export default adminSetOwnerPricing;
