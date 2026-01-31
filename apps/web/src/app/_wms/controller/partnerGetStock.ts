import { desc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsStock, wmsStockMovements } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

/**
 * Get stock owned by the current partner
 * Returns products with quantities and location details
 *
 * @example
 *   await trpcClient.wms.partner.getStock.query();
 */
const partnerGetStock = winePartnerProcedure.query(async ({ ctx: { partner } }) => {
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
    .where(eq(wmsStock.ownerId, partner.id))
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
    .where(eq(wmsStock.ownerId, partner.id))
    .orderBy(wmsStock.lwin18, wmsLocations.locationCode);

  // Group locations by LWIN
  const locationsByLwin = new Map<string, typeof stockByLocation>();
  for (const stock of stockByLocation) {
    const existing = locationsByLwin.get(stock.lwin18) ?? [];
    existing.push(stock);
    locationsByLwin.set(stock.lwin18, existing);
  }

  // Get recent movements for this partner's stock
  const recentMovements = await db
    .select({
      id: wmsStockMovements.id,
      movementNumber: wmsStockMovements.movementNumber,
      movementType: wmsStockMovements.movementType,
      productName: wmsStockMovements.productName,
      quantityCases: wmsStockMovements.quantityCases,
      performedAt: wmsStockMovements.performedAt,
    })
    .from(wmsStockMovements)
    .where(eq(wmsStockMovements.toOwnerId, partner.id))
    .orderBy(desc(wmsStockMovements.performedAt))
    .limit(10);

  return {
    partner: {
      id: partner.id,
      name: partner.companyName,
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
    })),
    recentMovements,
  };
});

export default partnerGetStock;
