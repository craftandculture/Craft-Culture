import { and, desc, eq, gt, inArray, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  saleMandateLots,
  saleMandates,
  wmsLocations,
  wmsPartnerRequests,
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
      // The parcel's own identity. A location id identifies a bay, and several
      // parcels can share one, so an action aimed at "this case" needs this.
      stockId: wmsStock.id,
      lwin18: wmsStock.lwin18,
      locationId: wmsStock.locationId,
      locationCode: wmsLocations.locationCode,
      quantityCases: wmsStock.quantityCases,
      availableCases: wmsStock.availableCases,
      reservedCases: wmsStock.reservedCases,
      lotNumber: wmsStock.lotNumber,
      receivedAt: wmsStock.receivedAt,
      expiryDate: wmsStock.expiryDate,
      /*
        Whether this parcel is currently sellable. The cellar could not show a
        member their own hold state at all before, so wine they had offered and
        wine they were keeping looked identical on the screen where they decide
        between the two.
      */
      notForSale: wmsStock.notForSale,
    })
    .from(wmsStock)
    .innerJoin(wmsLocations, eq(wmsStock.locationId, wmsLocations.id))
    .where(and(eq(wmsStock.ownerId, partner.id), gt(wmsStock.quantityCases, 0)))
    .orderBy(wmsStock.lwin18, wmsLocations.locationCode);

  /*
    The mandate a parcel sits under, when it has one. Read separately rather
    than joined so a parcel with no mandate — which is most of a cellar — costs
    nothing, and so the wine query keeps returning one row per parcel.
  */
  const mandateLots = await db
    .select({
      stockId: saleMandateLots.stockId,
      bottles: saleMandateLots.bottlesRemaining,
      mandateId: saleMandates.id,
      mandateNumber: saleMandates.mandateNumber,
      status: saleMandates.status,
      askPerBottleUsd: saleMandates.askPerBottleUsd,
    })
    .from(saleMandateLots)
    .innerJoin(saleMandates, eq(saleMandates.id, saleMandateLots.mandateId))
    .where(
      and(
        eq(saleMandates.ownerId, partner.id),
        inArray(saleMandates.status, [
          'offered',
          'listed',
          'placed',
          'partially_sold',
        ]),
      ),
    );

  const mandateByStock = new Map(
    mandateLots.map((lot) => [lot.stockId, lot]),
  );

  const stockWithSaleState = stockByLocation.map((stock) => ({
    ...stock,
    mandate: mandateByStock.get(stock.stockId) ?? null,
  }));

  // Group locations by LWIN
  const locationsByLwin = new Map<string, typeof stockWithSaleState>();
  for (const stock of stockWithSaleState) {
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

  /*
    Requests already open against this cellar.

    Without them the screen can only tell a member about their own request by
    refusing a second one, which is feedback delivered as an error.
  */
  const openRequests = await db
    .select({
      stockId: wmsPartnerRequests.stockId,
      requestNumber: wmsPartnerRequests.requestNumber,
      requestType: wmsPartnerRequests.requestType,
      status: wmsPartnerRequests.status,
      requestedAt: wmsPartnerRequests.requestedAt,
    })
    .from(wmsPartnerRequests)
    .where(
      and(
        eq(wmsPartnerRequests.partnerId, partner.id),
        eq(wmsPartnerRequests.status, 'pending'),
      ),
    )
    .orderBy(desc(wmsPartnerRequests.requestedAt));

  return {
    partner: {
      id: partner.id,
      /*
        businessName, not companyName — the latter is a users column and does
        not exist here, so this read was silently undefined and the cellar
        heading fell through to its placeholder. That placeholder was the word
        "Your cellar", which the tab above it already said.
      */
      name: partner.businessName,
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
    openRequests,
    recentMovements,
  };
});

export default partnerGetStock;
