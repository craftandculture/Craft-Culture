import { adminProcedure } from '@/lib/trpc/procedures';

import { setSellingPriceSchema } from '../schemas/pricingManagerSchema';
import writeProductPricing from '../utils/writeProductPricing';


/**
 * Upsert selling price for a product by LWIN18
 *
 * Uses raw postgres-js client to bypass Drizzle's RLS query builder.
 * If no pricing row exists yet, creates one with only the selling price set.
 *
 * @param lwin18 - The product LWIN18 identifier
 * @param sellingPricePerBottle - Selling price per bottle in USD
 */
const adminSetSellingPrice = adminProcedure
  .input(setSellingPriceSchema)
  .mutation(async ({ input, ctx }) => {
    const { lwin18, sellingPricePerBottle, ownerId } = input;

    const written = await writeProductPricing({
      lwin18,
      ownerId,
      set: { sellingPricePerBottle },
      userId: ctx.user.id,
    });

    return { lwin18, sellingPricePerBottle, ownerOnly: written.ownerOnly };
  });

export default adminSetSellingPrice;
