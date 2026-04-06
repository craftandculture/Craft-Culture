import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partners, wmsProductPricing } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { getProductPricingSchema } from '../schemas/pricingSchema';

/**
 * Get import price + partner margins for a single product
 *
 * Returns the stored import price and all active partners with their margin percentages,
 * so the frontend can calculate sales prices per partner.
 *
 * @param lwin18 - The product LWIN18 identifier
 */
const adminGetProductPricing = wmsOperatorProcedure
  .input(getProductPricingSchema)
  .query(async ({ input }) => {
    const [pricing] = await db
      .select()
      .from(wmsProductPricing)
      .where(eq(wmsProductPricing.lwin18, input.lwin18))
      .limit(1);

    const activePartners = await db
      .select({
        id: partners.id,
        companyName: partners.companyName,
        marginPercentage: partners.marginPercentage,
      })
      .from(partners)
      .where(eq(partners.status, 'active'));

    return {
      pricing: pricing ?? null,
      partners: activePartners,
    };
  });

export default adminGetProductPricing;
