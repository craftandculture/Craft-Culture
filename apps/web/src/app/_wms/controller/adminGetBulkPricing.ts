import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  wmsProductPricing,
  wmsStock,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getBulkPricingSchema } from '../schemas/pricingSchema';

/**
 * Get import prices for an array of LWIN18s (used for table column display)
 *
 * First checks wmsProductPricing for stored prices, then falls back to
 * productCostPerBottle from the latest shipment item for any missing LWIN18s.
 *
 * @param lwin18s - Array of product LWIN18 identifiers
 * @returns Map of lwin18 → import price data
 */
const adminGetBulkPricing = adminProcedure
  .input(getBulkPricingSchema)
  .query(async ({ input }) => {
    const { lwin18s } = input;

    // 1. Get stored import prices
    const storedRows = await db
      .select({
        lwin18: wmsProductPricing.lwin18,
        importPricePerBottle: wmsProductPricing.importPricePerBottle,
        importPriceSource: wmsProductPricing.importPriceSource,
      })
      .from(wmsProductPricing)
      .where(inArray(wmsProductPricing.lwin18, lwin18s));

    const priceMap: Record<
      string,
      {
        importPricePerBottle: number;
        importPriceSource: string;
      }
    > = {};

    for (const row of storedRows) {
      priceMap[row.lwin18] = {
        importPricePerBottle: row.importPricePerBottle,
        importPriceSource: row.importPriceSource,
      };
    }

    // 2. For missing LWIN18s, fall back to shipment item cost
    const missingLwin18s = lwin18s.filter((l) => !priceMap[l]);
    if (missingLwin18s.length > 0) {
      const shipmentRows = await db
        .selectDistinctOn([wmsStock.lwin18], {
          lwin18: wmsStock.lwin18,
          productCostPerBottle: logisticsShipmentItems.productCostPerBottle,
          landedCostPerBottle: logisticsShipmentItems.landedCostPerBottle,
        })
        .from(wmsStock)
        .innerJoin(
          logisticsShipmentItems,
          and(
            eq(logisticsShipmentItems.shipmentId, wmsStock.shipmentId),
            eq(logisticsShipmentItems.lwin, wmsStock.lwin18),
          ),
        )
        .where(
          and(
            inArray(wmsStock.lwin18, missingLwin18s),
            isNotNull(wmsStock.shipmentId),
          ),
        )
        .orderBy(wmsStock.lwin18, sql`${logisticsShipmentItems.createdAt} DESC`);

      for (const row of shipmentRows) {
        const cost = row.landedCostPerBottle ?? row.productCostPerBottle;
        if (cost != null) {
          priceMap[row.lwin18] = {
            importPricePerBottle: cost,
            importPriceSource: 'shipment',
          };
        }
      }
    }

    return priceMap;
  });

export default adminGetBulkPricing;
