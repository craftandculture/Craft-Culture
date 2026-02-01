import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsStock, wmsStockMovements } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getStockOverviewSchema } from '../schemas/stockQuerySchema';

/**
 * Get comprehensive WMS dashboard overview with KPIs and alerts
 *
 * @example
 *   await trpcClient.wms.admin.stock.getOverview.query({});
 */
const adminGetStockOverview = adminProcedure
  .input(getStockOverviewSchema)
  .query(async () => {
    const startTime = Date.now();

    // Prepare date constants for queries
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel for faster response
    const [
      stockStatsResult,
      locationStatsResult,
      occupiedStatsResult,
      expiryStatsResult,
      movementStatsResult,
      stockByOwner,
      receivingStockResult,
    ] = await Promise.all([
      // Get total stock stats
      db
        .select({
          totalCases: sql<number>`COALESCE(SUM(${wmsStock.quantityCases}), 0)::int`,
          totalAvailable: sql<number>`COALESCE(SUM(${wmsStock.availableCases}), 0)::int`,
          totalReserved: sql<number>`COALESCE(SUM(${wmsStock.reservedCases}), 0)::int`,
          uniqueProducts: sql<number>`COUNT(DISTINCT ${wmsStock.lwin18})::int`,
          uniqueOwners: sql<number>`COUNT(DISTINCT ${wmsStock.ownerId})::int`,
        })
        .from(wmsStock),

      // Get location stats
      db
        .select({
          totalLocations: sql<number>`COUNT(*)::int`,
          activeLocations: sql<number>`SUM(CASE WHEN ${wmsLocations.isActive} = true THEN 1 ELSE 0 END)::int`,
        })
        .from(wmsLocations),

      // Get occupied locations count
      db
        .select({
          occupiedLocations: sql<number>`COUNT(DISTINCT ${wmsStock.locationId})::int`,
        })
        .from(wmsStock),

      // Get expiry alerts
      db
        .select({
          expiredCases: sql<number>`COALESCE(SUM(CASE WHEN ${wmsStock.expiryDate} < NOW() THEN ${wmsStock.quantityCases} ELSE 0 END), 0)::int`,
          expiringThirtyDays: sql<number>`COALESCE(SUM(CASE WHEN ${wmsStock.expiryDate} >= NOW() AND ${wmsStock.expiryDate} <= ${thirtyDaysFromNow} THEN ${wmsStock.quantityCases} ELSE 0 END), 0)::int`,
          expiringNinetyDays: sql<number>`COALESCE(SUM(CASE WHEN ${wmsStock.expiryDate} > ${thirtyDaysFromNow} AND ${wmsStock.expiryDate} <= ${ninetyDaysFromNow} THEN ${wmsStock.quantityCases} ELSE 0 END), 0)::int`,
        })
        .from(wmsStock)
        .where(eq(wmsStock.isPerishable, true)),

      // Get recent movement counts
      db
        .select({
          last24Hours: sql<number>`SUM(CASE WHEN ${wmsStockMovements.performedAt} >= ${twentyFourHoursAgo} THEN 1 ELSE 0 END)::int`,
          last7Days: sql<number>`SUM(CASE WHEN ${wmsStockMovements.performedAt} >= ${sevenDaysAgo} THEN 1 ELSE 0 END)::int`,
        })
        .from(wmsStockMovements),

      // Get stock by owner summary
      db
        .select({
          ownerId: wmsStock.ownerId,
          ownerName: wmsStock.ownerName,
          totalCases: sql<number>`SUM(${wmsStock.quantityCases})::int`,
          productCount: sql<number>`COUNT(DISTINCT ${wmsStock.lwin18})::int`,
        })
        .from(wmsStock)
        .groupBy(wmsStock.ownerId, wmsStock.ownerName)
        .orderBy(sql`SUM(${wmsStock.quantityCases}) DESC`)
        .limit(10),

      // Get stock in receiving location
      db
        .select({
          casesInReceiving: sql<number>`COALESCE(SUM(${wmsStock.quantityCases}), 0)::int`,
        })
        .from(wmsStock)
        .innerJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
        .where(eq(wmsLocations.locationType, 'receiving')),
    ]);

    const stockStats = stockStatsResult[0];
    const locationStats = locationStatsResult[0];
    const occupiedStats = occupiedStatsResult[0];
    const expiryStats = expiryStatsResult[0];
    const movementStats = movementStatsResult[0];
    const receivingStock = receivingStockResult[0];

    console.log('[WMS] adminGetStockOverview completed in', Date.now() - startTime, 'ms');
    console.log('[WMS] stockStatsResult:', JSON.stringify(stockStatsResult));
    console.log('[WMS] stockStats:', JSON.stringify(stockStats));
    console.log('[WMS] stockByOwner:', JSON.stringify(stockByOwner));
    console.log('[WMS] locationStatsResult:', JSON.stringify(locationStatsResult));
    console.log('[WMS] locationStats:', JSON.stringify(locationStats));
    console.log('[WMS] movementStats:', JSON.stringify(movementStats));

    const totalLocs = locationStats?.totalLocations ?? 0;
    const activeLocs = locationStats?.activeLocations ?? 0;
    console.log('[WMS] totalLocs:', totalLocs, 'activeLocs:', activeLocs);

    return {
      summary: {
        totalCases: stockStats?.totalCases ?? 0,
        availableCases: stockStats?.totalAvailable ?? 0,
        reservedCases: stockStats?.totalReserved ?? 0,
        uniqueProducts: stockStats?.uniqueProducts ?? 0,
        uniqueOwners: stockStats?.uniqueOwners ?? 0,
      },
      locations: {
        total: totalLocs,
        active: activeLocs,
        occupied: occupiedStats?.occupiedLocations ?? 0,
        utilizationPercent:
          activeLocs > 0
            ? Math.round(((occupiedStats?.occupiedLocations ?? 0) / activeLocs) * 100)
            : 0,
      },
      expiry: {
        expiredCases: expiryStats?.expiredCases ?? 0,
        expiringThirtyDays: expiryStats?.expiringThirtyDays ?? 0,
        expiringNinetyDays: expiryStats?.expiringNinetyDays ?? 0,
        hasAlerts:
          (expiryStats?.expiredCases ?? 0) > 0 || (expiryStats?.expiringThirtyDays ?? 0) > 0,
      },
      movements: {
        last24Hours: movementStats?.last24Hours ?? 0,
        last7Days: movementStats?.last7Days ?? 0,
      },
      pendingPutaway: {
        casesInReceiving: receivingStock?.casesInReceiving ?? 0,
      },
      topOwners: stockByOwner,
    };
  });

export default adminGetStockOverview;
