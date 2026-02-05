import { desc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { partners, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getStockByOwnerSchema } from '../schemas/stockQuerySchema';

/**
 * Get stock grouped by owner with product breakdown
 * Shows all owners with their stock quantities and product counts
 *
 * @example
 *   await trpcClient.wms.admin.stock.getByOwner.query({});
 *   await trpcClient.wms.admin.stock.getByOwner.query({ ownerId: "uuid" });
 */
const adminGetStockByOwner = adminProcedure
  .input(getStockByOwnerSchema)
  .query(async ({ input }) => {
    const { ownerId } = input;

    if (ownerId) {
      // Get detailed stock for specific owner
      const ownerStock = await db
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
          consignmentCommissionPercent: wmsStock.consignmentCommissionPercent,
        })
        .from(wmsStock)
        .where(eq(wmsStock.ownerId, ownerId))
        .groupBy(
          wmsStock.lwin18,
          wmsStock.productName,
          wmsStock.producer,
          wmsStock.vintage,
          wmsStock.bottleSize,
          wmsStock.caseConfig,
          wmsStock.salesArrangement,
          wmsStock.consignmentCommissionPercent,
        )
        .orderBy(desc(sql`SUM(${wmsStock.quantityCases})`));

      // Get owner details
      const [owner] = await db
        .select({
          id: partners.id,
          name: partners.businessName,
          type: partners.type,
        })
        .from(partners)
        .where(eq(partners.id, ownerId));

      // Calculate totals
      const totalCases = ownerStock.reduce((sum, s) => sum + s.totalCases, 0);
      const totalAvailable = ownerStock.reduce((sum, s) => sum + s.availableCases, 0);
      const totalReserved = ownerStock.reduce((sum, s) => sum + s.reservedCases, 0);

      return {
        owner: owner ?? { id: ownerId, name: 'Unknown', type: null },
        summary: {
          totalCases,
          availableCases: totalAvailable,
          reservedCases: totalReserved,
          productCount: ownerStock.length,
        },
        products: ownerStock,
      };
    }

    // Get all owners with stock summary
    const owners = await db
      .select({
        ownerId: wmsStock.ownerId,
        ownerName: wmsStock.ownerName,
        totalCases: sql<number>`SUM(${wmsStock.quantityCases})::int`,
        availableCases: sql<number>`SUM(${wmsStock.availableCases})::int`,
        reservedCases: sql<number>`SUM(${wmsStock.reservedCases})::int`,
        productCount: sql<number>`COUNT(DISTINCT ${wmsStock.lwin18})::int`,
        locationCount: sql<number>`COUNT(DISTINCT ${wmsStock.locationId})::int`,
        consignmentCount: sql<number>`COUNT(*) FILTER (WHERE ${wmsStock.salesArrangement} = 'consignment')::int`,
        purchasedCount: sql<number>`COUNT(*) FILTER (WHERE ${wmsStock.salesArrangement} = 'purchased')::int`,
      })
      .from(wmsStock)
      .groupBy(wmsStock.ownerId, wmsStock.ownerName)
      .orderBy(desc(sql`SUM(${wmsStock.quantityCases})`));

    // Calculate grand totals
    const grandTotals = {
      totalCases: owners.reduce((sum, o) => sum + o.totalCases, 0),
      availableCases: owners.reduce((sum, o) => sum + o.availableCases, 0),
      reservedCases: owners.reduce((sum, o) => sum + o.reservedCases, 0),
      ownerCount: owners.length,
    };

    return {
      owners,
      grandTotals,
    };
  });

export default adminGetStockByOwner;
