import { sql } from 'drizzle-orm';

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
          activeLocations: sql<number>`COUNT(*) FILTER (WHERE ${wmsLocations.isActive} = true)::int`,
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
        .where(sql`${wmsStock.isPerishable} = true`),

      // Get recent movement counts
      db
        .select({
          last24Hours: sql<number>`COUNT(*) FILTER (WHERE ${wmsStockMovements.performedAt} >= ${twentyFourHoursAgo})::int`,
          last7Days: sql<number>`COUNT(*) FILTER (WHERE ${wmsStockMovements.performedAt} >= ${sevenDaysAgo})::int`,
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
        .innerJoin(wmsLocations, sql`${wmsLocations.id} = ${wmsStock.locationId}`)
        .where(sql`${wmsLocations.locationType} = 'receiving'`),
    ]);

    const stockStats = stockStatsResult[0];
    const locationStats = locationStatsResult[0];
    const occupiedStats = occupiedStatsResult[0];
    const expiryStats = expiryStatsResult[0];
    const movementStats = movementStatsResult[0];
    const receivingStock = receivingStockResult[0];

    console.log('[WMS] adminGetStockOverview completed in', Date.now() - startTime, 'ms');

    return {
      summary: {
        totalCases: stockStats?.totalCases ?? 0,
        availableCases: stockStats?.totalAvailable ?? 0,
        reservedCases: stockStats?.totalReserved ?? 0,
        uniqueProducts: stockStats?.uniqueProducts ?? 0,
        uniqueOwners: stockStats?.uniqueOwners ?? 0,
      },
      locations: {
        total: locationStats?.totalLocations ?? 0,
        active: locationStats?.activeLocations ?? 0,
        occupied: occupiedStats?.occupiedLocations ?? 0,
        utilizationPercent:
          locationStats?.activeLocations && locationStats.activeLocations > 0
            ? Math.round(
                ((occupiedStats?.occupiedLocations ?? 0) / locationStats.activeLocations) * 100,
              )
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
