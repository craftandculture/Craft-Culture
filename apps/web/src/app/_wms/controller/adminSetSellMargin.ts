import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { setSellMarginSchema } from '../schemas/pricingManagerSchema';
import writeProductPricing from '../utils/writeProductPricing';


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

    await writeProductPricing({
      lwin18,
      set: { sellMarginPct, sellingPricePerBottle },
      userId: ctx.user.id,
    });

    return { lwin18, sellMarginPct, sellingPricePerBottle };
  });

export default adminSetSellMargin;
