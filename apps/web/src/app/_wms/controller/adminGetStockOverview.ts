import { and, eq, gt, inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  wmsLocations,
  wmsOwnerPricing,
  wmsOwnerPricingSettings,
  wmsProductPricing,
  wmsStock,
  wmsStockMovements,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { getStockOverviewSchema } from '../schemas/stockQuerySchema';

/**
 * Get comprehensive WMS dashboard overview with KPIs and alerts
 *
 * @example
 *   await trpcClient.wms.admin.stock.getOverview.query({});
 */
const adminGetStockOverview = wmsOperatorProcedure
  .input(getStockOverviewSchema)
  .query(async ({ input }) => {
    const { ownerId } = input;
    // When an owner is selected, scope stock stats + valuation to that owner
    const ownerCond = ownerId ? eq(wmsStock.ownerId, ownerId) : undefined;

    // Effective per-bottle cost/price expressions (mirror the Pricing Manager):
    // import falls back to the latest shipment cost; landed adds override +
    // owner logistics; in-bond & PC apply the owner's margins.
    const shipJoin = sql`(SELECT DISTINCT ON (lwin) lwin AS lwin18, COALESCE(landed_cost_per_bottle, product_cost_per_bottle) AS cost FROM logistics_shipment_items WHERE lwin IS NOT NULL ORDER BY lwin, created_at DESC) ship`;
    const impFb = sql`COALESCE(NULLIF(${wmsProductPricing.importPricePerBottle}, 0), ship.cost, 0)`;
    // Spirits & RTD carry no logistics; only Wine uses the owner's logistics rate.
    const logisticsExpr = sql`(CASE WHEN ${wmsStock.category} IN ('Spirits', 'RTD') THEN 0 ELSE COALESCE(${wmsOwnerPricingSettings.logisticsPerBottle}, 25) END)`;
    const landedExpr = sql`(${impFb} + COALESCE(${wmsProductPricing.costOverridePerBottle}, 0) + ${logisticsExpr})`;
    const inBondExpr = sql`(${landedExpr} / (1 - COALESCE(${wmsOwnerPricingSettings.inbondMarginPct}, 0) / 100.0))`;
    const pcExpr = sql`(CASE
      WHEN ${wmsOwnerPricingSettings.pcMarginPct} IS NOT NULL AND ${wmsOwnerPricingSettings.pcMarginPct} < 100
      THEN ${landedExpr} / (1 - COALESCE(${wmsOwnerPricingSettings.inbondMarginPct}, 0) / 100.0) / (1 - ${wmsOwnerPricingSettings.pcMarginPct} / 100.0)
      ELSE COALESCE(${wmsOwnerPricing.pcSellingPricePerBottle}, ${wmsProductPricing.sellingPricePerBottle}, 0)
    END)`;
    const btl = sql`${wmsStock.quantityCases} * ${wmsStock.caseConfig}`;

    // Prepare date constants for queries (as ISO strings for SQL compatibility)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Run all queries in parallel for faster response
    const [
      stockStatsResult,
      locationStatsResult,
      occupiedStatsResult,
      expiryStatsResult,
      movementStatsResult,
      stockByOwner,
      receivingStockResult,
      inboundStockResult,
      valuationResult,
      valueByOwnerResult,
    ] = await Promise.all([
      // Get total stock stats
      db
        .select({
          totalCases: sql<number>`COALESCE(SUM(${wmsStock.quantityCases}), 0)::int`,
          totalBottles: sql<number>`COALESCE(SUM(${wmsStock.quantityCases} * ${wmsStock.caseConfig}), 0)::int`,
          totalAvailable: sql<number>`COALESCE(SUM(${wmsStock.availableCases}), 0)::int`,
          totalReserved: sql<number>`COALESCE(SUM(${wmsStock.reservedCases}), 0)::int`,
          uniqueProducts: sql<number>`COUNT(DISTINCT ${wmsStock.lwin18})::int`,
          uniqueOwners: sql<number>`COUNT(DISTINCT ${wmsStock.ownerId})::int`,
        })
        .from(wmsStock)
        .where(and(gt(wmsStock.quantityCases, 0), ownerCond)),

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
        .from(wmsStock)
        .where(gt(wmsStock.quantityCases, 0)),

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
        .where(gt(wmsStock.quantityCases, 0))
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

      // Get inbound stock from active logistics shipments
      db
        .select({
          inboundCases: sql<number>`COALESCE(SUM(${logisticsShipmentItems.cases}), 0)::int`,
          inboundShipments: sql<number>`COUNT(DISTINCT ${logisticsShipments.id})::int`,
          inboundValue: sql<number>`COALESCE(SUM(${logisticsShipmentItems.cases} * COALESCE(${logisticsShipmentItems.bottlesPerCase}, 12) * COALESCE(${logisticsShipmentItems.landedCostPerBottle}, ${logisticsShipmentItems.productCostPerBottle}, 0)), 0)::float`,
        })
        .from(logisticsShipmentItems)
        .innerJoin(
          logisticsShipments,
          eq(logisticsShipmentItems.shipmentId, logisticsShipments.id),
        )
        .where(
          and(
            eq(logisticsShipments.type, 'inbound'),
            inArray(logisticsShipments.status, [
              'booked',
              'picked_up',
              'in_transit',
              'arrived_port',
              'customs_clearance',
              'cleared',
              'at_warehouse',
            ]),
            // Owner = item override, else the shipment's partner
            ownerId
              ? sql`COALESCE(${logisticsShipmentItems.overrideOwnerId}, ${logisticsShipments.partnerId}) = ${ownerId}`
              : undefined,
          ),
        ),

      // Total inventory value at each tier (cost / in-bond / PC) with fallback
      db
        .select({
          costValue: sql<number>`COALESCE(SUM(${btl} * ${landedExpr}), 0)::float`,
          inBondValue: sql<number>`COALESCE(SUM(CASE WHEN ${landedExpr} > 0 THEN ${btl} * ${inBondExpr} END), 0)::float`,
          pcValue: sql<number>`COALESCE(SUM(CASE WHEN ${pcExpr} > 0 THEN ${btl} * ${pcExpr} END), 0)::float`,
          pricedProducts: sql<number>`COUNT(DISTINCT CASE WHEN ${impFb} > 0 THEN ${wmsStock.lwin18} END)::int`,
        })
        .from(wmsStock)
        .leftJoin(wmsProductPricing, eq(wmsStock.lwin18, wmsProductPricing.lwin18))
        .leftJoin(wmsOwnerPricingSettings, eq(wmsOwnerPricingSettings.ownerId, wmsStock.ownerId))
        .leftJoin(
          wmsOwnerPricing,
          and(eq(wmsOwnerPricing.lwin18, wmsStock.lwin18), eq(wmsOwnerPricing.ownerId, wmsStock.ownerId)),
        )
        .leftJoin(shipJoin, sql`ship.lwin18 = ${wmsStock.lwin18}`)
        .where(and(gt(wmsStock.quantityCases, 0), ownerCond)),

      // Value broken down by owner (top 15 by cost value)
      db
        .select({
          ownerId: wmsStock.ownerId,
          ownerName: wmsStock.ownerName,
          costValue: sql<number>`COALESCE(SUM(${btl} * ${landedExpr}), 0)::float`,
          inBondValue: sql<number>`COALESCE(SUM(CASE WHEN ${landedExpr} > 0 THEN ${btl} * ${inBondExpr} END), 0)::float`,
          pcValue: sql<number>`COALESCE(SUM(CASE WHEN ${pcExpr} > 0 THEN ${btl} * ${pcExpr} END), 0)::float`,
          cases: sql<number>`SUM(${wmsStock.quantityCases})::int`,
        })
        .from(wmsStock)
        .leftJoin(wmsProductPricing, eq(wmsStock.lwin18, wmsProductPricing.lwin18))
        .leftJoin(wmsOwnerPricingSettings, eq(wmsOwnerPricingSettings.ownerId, wmsStock.ownerId))
        .leftJoin(
          wmsOwnerPricing,
          and(eq(wmsOwnerPricing.lwin18, wmsStock.lwin18), eq(wmsOwnerPricing.ownerId, wmsStock.ownerId)),
        )
        .leftJoin(shipJoin, sql`ship.lwin18 = ${wmsStock.lwin18}`)
        .where(and(gt(wmsStock.quantityCases, 0), ownerCond))
        .groupBy(wmsStock.ownerId, wmsStock.ownerName)
        .orderBy(sql`SUM(${btl} * ${landedExpr}) DESC`)
        .limit(15),
    ]);

    const stockStats = stockStatsResult[0];
    const locationStats = locationStatsResult[0];
    const occupiedStats = occupiedStatsResult[0];
    const expiryStats = expiryStatsResult[0];
    const movementStats = movementStatsResult[0];
    const receivingStock = receivingStockResult[0];
    const inboundStock = inboundStockResult[0];
    const valuation = valuationResult[0];

    const totalLocs = locationStats?.totalLocations ?? 0;
    const activeLocs = locationStats?.activeLocations ?? 0;

    return {
      summary: {
        totalCases: stockStats?.totalCases ?? 0,
        totalBottles: stockStats?.totalBottles ?? 0,
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
      inbound: {
        cases: inboundStock?.inboundCases ?? 0,
        shipments: inboundStock?.inboundShipments ?? 0,
        value: Math.round((inboundStock?.inboundValue ?? 0) * 100) / 100,
      },
      valuation: {
        // Cost (landed) value — kept as `totalValue` for the headline
        totalValue: Math.round((valuation?.costValue ?? 0) * 100) / 100,
        costValue: Math.round((valuation?.costValue ?? 0) * 100) / 100,
        inBondValue: Math.round((valuation?.inBondValue ?? 0) * 100) / 100,
        pcValue: Math.round((valuation?.pcValue ?? 0) * 100) / 100,
        pricedProducts: valuation?.pricedProducts ?? 0,
        totalProducts: stockStats?.uniqueProducts ?? 0,
        byOwner: valueByOwnerResult.map((o) => ({
          ownerId: o.ownerId,
          ownerName: o.ownerName,
          costValue: Math.round(o.costValue * 100) / 100,
          inBondValue: Math.round(o.inBondValue * 100) / 100,
          pcValue: Math.round(o.pcValue * 100) / 100,
          cases: o.cases,
        })),
      },
    };
  });

export default adminGetStockOverview;
