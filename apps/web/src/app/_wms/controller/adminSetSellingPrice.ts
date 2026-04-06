import { client } from '@/database/client';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { setSellingPriceSchema } from '../schemas/pricingManagerSchema';

/**
 * Upsert selling price for a product by LWIN18
 *
 * Uses raw postgres-js client to bypass Drizzle's RLS query builder.
 * If no pricing row exists yet, creates one with only the selling price set.
 *
 * @param lwin18 - The product LWIN18 identifier
 * @param sellingPricePerBottle - Selling price per bottle in USD
 */
const adminSetSellingPrice = wmsOperatorProcedure
  .input(setSellingPriceSchema)
  .mutation(async ({ input, ctx }) => {
    const { lwin18, sellingPricePerBottle } = input;

    await client`
      INSERT INTO wms_product_pricing (lwin18, import_price_per_bottle, selling_price_per_bottle, updated_by)
      VALUES (${lwin18}, 0, ${sellingPricePerBottle}, ${ctx.user.id})
      ON CONFLICT (lwin18) DO UPDATE SET
        selling_price_per_bottle = ${sellingPricePerBottle},
        updated_by = ${ctx.user.id},
        updated_at = NOW()
    `;

    return { lwin18, sellingPricePerBottle };
  });

export default adminSetSellingPrice;
