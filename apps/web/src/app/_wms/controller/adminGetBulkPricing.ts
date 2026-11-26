import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  wmsOwnerPricingSettings,
  wmsProductPricing,
  wmsStock,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getBulkPricingSchema } from '../schemas/pricingSchema';
import lotShipmentCost from '../utils/lotShipmentCost';
import lwinPakKey from '../utils/lwinPakKey';
import ownerPricingJoin from '../utils/ownerPricingJoin';
import ownerPricingReady from '../utils/ownerPricingReady';
import pakKeyOf from '../utils/pakKeyOf';
import stockPricingInput from '../utils/stockPricingInput';
import stockPricingSelect from '../utils/stockPricingSelect';

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
const adminGetBulkPricing = adminProcedure
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
        /** Each owner's own lot cost, where owners differ */
        byOwner?: Record<string, number>;
      }
    > = {};

    if (keysWanted.length === 0) return priceMap;

    /*
      0. The lot cost the Pricing Manager prices each owner's row from: the
         newest lot's own invoice line, then a typed price, then the shipment.
         Stock Explorer read only the typed price, so lots costed from their
         shipment invoice (Le Petit Cheval, Maison Wineted on SHP-2026-0034)
         showed $0 here while the Pricing Manager had their cost (Sophie,
         20 Nov). Where owners' lots cost differently, the highest shows, as
         on the price list, and each owner's is returned beside it.
    */
    const lotRows = await db
      .select({
        key: sql<string>`${lwinPakKey(wmsStock.lwin18)}`,
        ownerId: wmsStock.ownerId,
        ...stockPricingSelect,
      })
      .from(wmsStock)
      .leftJoin(
        wmsProductPricing,
        sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${lwinPakKey(wmsStock.lwin18)}`,
      )
      .leftJoin(ownerPricingJoin(await ownerPricingReady()), sql`true`)
      .leftJoin(lotShipmentCost, sql`true`)
      .leftJoin(
        wmsOwnerPricingSettings,
        eq(wmsOwnerPricingSettings.ownerId, wmsStock.ownerId),
      )
      .where(inArray(lwinPakKey(wmsStock.lwin18), keysWanted))
      .groupBy(lwinPakKey(wmsStock.lwin18), wmsStock.ownerId);

    const lotByKey = new Map<string, Record<string, number>>();

    for (const raw of lotRows) {
      const { importPricePerBottle } = stockPricingInput(raw);

      if (importPricePerBottle == null || importPricePerBottle <= 0) continue;

      const owners = lotByKey.get(raw.key) ?? {};

      owners[raw.ownerId] = importPricePerBottle;
      lotByKey.set(raw.key, owners);
    }

    const byKey = new Map<
      string,
      { price: number; source: string; byOwner?: Record<string, number> }
    >();

    for (const [key, owners] of lotByKey) {
      const prices = Object.values(owners);
      const distinct = new Set(prices.map((price) => price.toFixed(2)));

      byKey.set(key, {
        price: Math.max(...prices),
        source: 'lot',
        ...(distinct.size > 1 ? { byOwner: owners } : {}),
      });
    }

    // 1. Stored import prices, by wine rather than by pack
    const storedRows = await db
      .select({
        key: sql<string>`${lwinPakKey(wmsProductPricing.lwin18)}`,
        importPricePerBottle: wmsProductPricing.importPricePerBottle,
        importPriceSource: wmsProductPricing.importPriceSource,
      })
      .from(wmsProductPricing)
      .where(inArray(lwinPakKey(wmsProductPricing.lwin18), keysWanted));

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
        ...(found.byOwner ? { byOwner: found.byOwner } : {}),
      };
    }

    return priceMap;
  });

export default adminGetBulkPricing;
