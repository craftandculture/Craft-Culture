import { and, desc, inArray, isNotNull, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentItems, wmsProductPricing } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { getBulkPricingSchema } from '../schemas/pricingSchema';
import lwinPakKey from '../utils/lwinPakKey';
import pakKeyOf from '../utils/pakKeyOf';

/**
 * Get import prices for an array of LWIN18s (used for table column display)
 *
 * Matched pack-agnostically, as prices are: a price is per BOTTLE, so it
 * belongs to the wine, vintage and bottle size rather than the pack it happens
 * to sit in. Splitting a six into singles mints `…-01-…` stock rows, and both
 * lookups here keyed on the exact code — so a repacked bottle showed no import
 * price and no value while the case it came out of was priced, and the wine
 * read as unpriced stock nobody could quote.
 *
 * The per-bottle figure carries over unchanged, which is the whole point: six
 * singles out of a $600 case are $100 each, and the case price of a single is
 * $100.
 *
 * Stored prices win; a wine with none falls back to the cost of the shipment
 * line it came from — matched the same way, since the repacked pack has no
 * shipment line of its own.
 *
 * @param lwin18s - Array of product LWIN18 identifiers
 * @returns Map of lwin18 → import price data
 */
const adminGetBulkPricing = wmsOperatorProcedure
  .input(getBulkPricingSchema)
  .query(async ({ input }) => {
    const { lwin18s } = input;

    /** Requested codes, grouped by the wine they belong to */
    const keysWanted = [...new Set(lwin18s.map(pakKeyOf))].filter(Boolean);

    const priceMap: Record<
      string,
      {
        importPricePerBottle: number;
        importPriceSource: string;
      }
    > = {};

    if (keysWanted.length === 0) return priceMap;

    // 1. Stored import prices, by wine rather than by pack
    const storedRows = await db
      .select({
        key: sql<string>`${lwinPakKey(wmsProductPricing.lwin18)}`,
        importPricePerBottle: wmsProductPricing.importPricePerBottle,
        importPriceSource: wmsProductPricing.importPriceSource,
      })
      .from(wmsProductPricing)
      .where(inArray(lwinPakKey(wmsProductPricing.lwin18), keysWanted));

    const byKey = new Map<string, { price: number; source: string }>();

    for (const row of storedRows) {
      if (row.importPricePerBottle == null) continue;
      if (byKey.has(row.key)) continue;

      byKey.set(row.key, {
        price: row.importPricePerBottle,
        source: row.importPriceSource,
      });
    }

    // 2. Anything still unpriced falls back to the shipment line's own cost,
    //    matched the same way — the repacked pack has no line of its own.
    const stillMissing = keysWanted.filter((key) => !byKey.has(key));

    if (stillMissing.length > 0) {
      const shipmentRows = await db
        .select({
          key: sql<string>`${lwinPakKey(logisticsShipmentItems.lwin)}`,
          productCostPerBottle: logisticsShipmentItems.productCostPerBottle,
          landedCostPerBottle: logisticsShipmentItems.landedCostPerBottle,
        })
        .from(logisticsShipmentItems)
        .where(
          and(
            inArray(lwinPakKey(logisticsShipmentItems.lwin), stillMissing),
            isNotNull(logisticsShipmentItems.lwin),
          ),
        )
        .orderBy(desc(logisticsShipmentItems.createdAt));

      // First per key = latest shipment, since the rows are ordered by date
      for (const row of shipmentRows) {
        if (byKey.has(row.key)) continue;

        const cost = row.landedCostPerBottle ?? row.productCostPerBottle;

        if (cost != null) byKey.set(row.key, { price: cost, source: 'shipment' });
      }
    }

    // Answered per code asked for, whatever pack it is
    for (const lwin18 of lwin18s) {
      const found = byKey.get(pakKeyOf(lwin18));

      if (!found) continue;

      priceMap[lwin18] = {
        importPricePerBottle: found.price,
        importPriceSource: found.source,
      };
    }

    return priceMap;
  });

export default adminGetBulkPricing;
