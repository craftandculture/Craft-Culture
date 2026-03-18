import { inArray } from 'drizzle-orm';

import db from '@/database/client';
import { wmsProductPricing } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getBulkPricingSchema } from '../schemas/pricingSchema';

/**
 * Get import prices for an array of LWIN18s (used for table column display)
 *
 * @param lwin18s - Array of product LWIN18 identifiers
 * @returns Map of lwin18 → import price data
 */
const adminGetBulkPricing = adminProcedure
  .input(getBulkPricingSchema)
  .query(async ({ input }) => {
    const rows = await db
      .select({
        lwin18: wmsProductPricing.lwin18,
        importPricePerBottle: wmsProductPricing.importPricePerBottle,
        importPriceSource: wmsProductPricing.importPriceSource,
      })
      .from(wmsProductPricing)
      .where(inArray(wmsProductPricing.lwin18, input.lwin18s));

    const priceMap: Record<
      string,
      {
        importPricePerBottle: number;
        importPriceSource: string;
      }
    > = {};

    for (const row of rows) {
      priceMap[row.lwin18] = {
        importPricePerBottle: row.importPricePerBottle,
        importPriceSource: row.importPriceSource,
      };
    }

    return priceMap;
  });

export default adminGetBulkPricing;
