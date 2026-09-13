import { and, desc, eq, gt, inArray, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  wmsLocations,
  wmsProductPricing,
  wmsStock,
  wmsStockMovements,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import INBOUND_SHIPMENT_STATUSES from '../utils/inboundShipmentStatuses';

/**
 * Get stock owned by the current partner
 *
 * Serves both a wine partner and a private collector: the question is the same
 * either way — what does this owner have in the warehouse — and the
 * answer is already scoped by `ownerId`.
 *
 * Returns products with quantities and location details
 *
 * @example
 *   await trpcClient.wms.partner.getStock.query();
 */
const partnerGetStock = stockOwnerProcedure.query(async ({ ctx: { partner } }) => {
  // Get stock grouped by product
  const products = await db
    .select({
      lwin18: wmsStock.lwin18,
      productName: wmsStock.productName,
      producer: wmsStock.producer,
      vintage: wmsStock.vintage,
      bottleSize: wmsStock.bottleSize,
      caseConfig: wmsStock.caseConfig,
      totalCases: sql<number>`SUM(${wmsStock.quantityCases})::int`,
      availableCases: sql<number>`SUM(${wmsStock.availableCases})::int`,
      reservedCases: sql<number>`SUM(${wmsStock.reservedCases})::int`,
      locationCount: sql<number>`COUNT(DISTINCT ${wmsStock.locationId})::int`,
      salesArrangement: wmsStock.salesArrangement,
    })
    .from(wmsStock)
    .where(and(eq(wmsStock.ownerId, partner.id), gt(wmsStock.quantityCases, 0)))
    .groupBy(
      wmsStock.lwin18,
      wmsStock.productName,
      wmsStock.producer,
      wmsStock.vintage,
      wmsStock.bottleSize,
      wmsStock.caseConfig,
      wmsStock.salesArrangement,
    )
    .orderBy(desc(sql`SUM(${wmsStock.quantityCases})`));

  // Calculate totals
  const totalCases = products.reduce((sum, p) => sum + p.totalCases, 0);
  const totalAvailable = products.reduce((sum, p) => sum + p.availableCases, 0);
  const totalReserved = products.reduce((sum, p) => sum + p.reservedCases, 0);

  // Get location breakdown for each product
  const stockByLocation = await db
    .select({
      lwin18: wmsStock.lwin18,
      locationId: wmsStock.locationId,
      locationCode: wmsLocations.locationCode,
      quantityCases: wmsStock.quantityCases,
      availableCases: wmsStock.availableCases,
      reservedCases: wmsStock.reservedCases,
      lotNumber: wmsStock.lotNumber,
      receivedAt: wmsStock.receivedAt,
      expiryDate: wmsStock.expiryDate,
    })
    .from(wmsStock)
    .innerJoin(wmsLocations, eq(wmsStock.locationId, wmsLocations.id))
    .where(and(eq(wmsStock.ownerId, partner.id), gt(wmsStock.quantityCases, 0)))
    .orderBy(wmsStock.lwin18, wmsLocations.locationCode);

  // Group locations by LWIN
  const locationsByLwin = new Map<string, typeof stockByLocation>();
  for (const stock of stockByLocation) {
    const existing = locationsByLwin.get(stock.lwin18) ?? [];
    existing.push(stock);
    locationsByLwin.set(stock.lwin18, existing);
  }

  // Get recent movements for this partner's stock (inbound + outbound)
  const recentMovements = await db
    .select({
      id: wmsStockMovements.id,
      movementNumber: wmsStockMovements.movementNumber,
      movementType: wmsStockMovements.movementType,
      productName: wmsStockMovements.productName,
      lwin18: wmsStockMovements.lwin18,
      quantityCases: wmsStockMovements.quantityCases,
      fromOwnerId: wmsStockMovements.fromOwnerId,
      toOwnerId: wmsStockMovements.toOwnerId,
      notes: wmsStockMovements.notes,
      performedAt: wmsStockMovements.performedAt,
    })
    .from(wmsStockMovements)
    .where(
      or(
        eq(wmsStockMovements.toOwnerId, partner.id),
        eq(wmsStockMovements.fromOwnerId, partner.id),
      ),
    )
    .orderBy(desc(wmsStockMovements.performedAt))
    .limit(50);

  /*
    What the wine cost when it was imported — the figure on the import
    documents, not a market valuation. C&C does not value collections, so this
    is labelled as what it is: the recorded import cost, which is also what an
    insurance declaration is built from.

    Preferring the pricing record and falling back to the most recent shipment
    line mirrors how the Pricing Manager resolves the same number.
  */
  const costRows = await db
    .select({
      lwin18: wmsStock.lwin18,
      costPerBottle: sql<number | null>`COALESCE(
        NULLIF(MAX(${wmsProductPricing.importPricePerBottle}), 0),
        MAX(${logisticsShipmentItems.productCostPerBottle})
      )`,
    })
    .from(wmsStock)
    .leftJoin(
      wmsProductPricing,
      eq(wmsProductPricing.lwin18, wmsStock.lwin18),
    )
    .leftJoin(
      logisticsShipmentItems,
      eq(logisticsShipmentItems.lwin, wmsStock.lwin18),
    )
    .where(and(eq(wmsStock.ownerId, partner.id), gt(wmsStock.quantityCases, 0)))
    .groupBy(wmsStock.lwin18);

  const costByLwin = new Map(
    costRows.map((row) => [row.lwin18, Number(row.costPerBottle ?? 0)]),
  );

  /*
    Wine bought and shipped but not yet received owns no warehouse row, so it
    was invisible here — a collector who has just bought sees nothing at all
    until it lands, which is exactly when they most want to look.
  */
  const inbound = await db
    .select({
      lwin18: logisticsShipmentItems.lwin,
      productName: logisticsShipmentItems.productName,
      producer: logisticsShipmentItems.producer,
      vintage: logisticsShipmentItems.vintage,
      bottlesPerCase: logisticsShipmentItems.bottlesPerCase,
      cases: logisticsShipmentItems.cases,
      totalBottles: logisticsShipmentItems.totalBottles,
      shipmentNumber: logisticsShipments.shipmentNumber,
      status: logisticsShipments.status,
      eta: logisticsShipments.eta,
    })
    .from(logisticsShipmentItems)
    .innerJoin(
      logisticsShipments,
      eq(logisticsShipmentItems.shipmentId, logisticsShipments.id),
    )
    .where(
      and(
        eq(logisticsShipments.partnerId, partner.id),
        eq(logisticsShipments.type, 'inbound'),
        inArray(logisticsShipments.status, [...INBOUND_SHIPMENT_STATUSES]),
      ),
    )
    .orderBy(logisticsShipments.eta);

  return {
    partner: {
      id: partner.id,
      name: partner.companyName,
      // A collector's screen is their cellar; a partner's is their stock.
      type: partner.type,
    },
    summary: {
      totalCases,
      availableCases: totalAvailable,
      reservedCases: totalReserved,
      productCount: products.length,
    },
    products: products.map((product) => ({
      ...product,
      locations: locationsByLwin.get(product.lwin18) ?? [],
      costPerBottle: costByLwin.get(product.lwin18) ?? null,
    })),
    inbound,
    recentMovements,
  };
});

export default partnerGetStock;
