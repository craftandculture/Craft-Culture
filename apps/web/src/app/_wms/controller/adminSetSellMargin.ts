import { client } from '@/database/client';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { setSellMarginSchema } from '../schemas/pricingManagerSchema';

/**
 * Upsert a bespoke per-line margin % (Spirits/RTD) and its derived selling
 * price for a product by LWIN18.
 *
 * The frontend computes `sellingPricePerBottle = landed / (1 - sellMarginPct/100)`
 * and passes both so downstream consumers (orders, quotes) still read a
 * concrete price. Passing nulls clears the bespoke margin and price.
 *
 * @param lwin18 - The product LWIN18 identifier
 * @param sellMarginPct - Bespoke margin % over landed, or null to clear
 * @param sellingPricePerBottle - Derived selling price, or null to clear
 */
const adminSetSellMargin = wmsOperatorProcedure
  .input(setSellMarginSchema)
  .mutation(async ({ input, ctx }) => {
    const { lwin18, sellMarginPct, sellingPricePerBottle } = input;

    await client`
      INSERT INTO wms_product_pricing (lwin18, import_price_per_bottle, sell_margin_pct, selling_price_per_bottle, updated_by)
      VALUES (${lwin18}, 0, ${sellMarginPct}, ${sellingPricePerBottle}, ${ctx.user.id})
      ON CONFLICT (lwin18) DO UPDATE SET
        sell_margin_pct = ${sellMarginPct},
        selling_price_per_bottle = ${sellingPricePerBottle},
        updated_by = ${ctx.user.id},
        updated_at = NOW()
    `;

    return { lwin18, sellMarginPct, sellingPricePerBottle };
  });

export default adminSetSellMargin;
