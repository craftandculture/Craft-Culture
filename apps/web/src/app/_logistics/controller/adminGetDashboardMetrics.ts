import { and, count, desc, eq, gte, isNotNull, lt, sql, sum } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsDocuments,
  logisticsJobs,
  logisticsQuoteRequests,
  logisticsQuotes,
  logisticsShipmentItems,
  logisticsShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getOpenQuoteRequestSteps from '../data/getOpenQuoteRequestSteps';
import { partyLogoSql, partyNameSql } from '../utils/shipmentPartySql';

/**
 * Get dashboard metrics for the logistics overview page
 *
 * Returns optimized data for the dashboard including:
 * - Status counts for active shipments
 * - Recent shipments list
 * - Document compliance summary
 * - Cost overview
 * - Pending quotes count
 */
const adminGetDashboardMetrics = adminProcedure.query(async () => {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Run all queries in parallel for better performance
  const [
    shipmentsByStatus,
    recentShipments,
    requiredDocs,
    verifiedDocs,
    expiringDocs,
    expiredDocs,
    monthlyCosts,
    pendingQuotes,
    expiringQuotes,
    recentActivity,
    pendingQuoteRequests,
    inProgressQuoteRequests,
    requestSteps,
  ] = await Promise.all([
    // Shipment counts by status
    db
      .select({
        status: logisticsShipments.status,
        count: count(),
      })
      .from(logisticsShipments)
      .groupBy(logisticsShipments.status),

    // Recent shipments: live, or finished in the last week (top 20)
    db
      .select({
        id: logisticsShipments.id,
        shipmentNumber: logisticsShipments.shipmentNumber,
        name: logisticsShipments.name,
        status: logisticsShipments.status,
        type: logisticsShipments.type,
        transportMode: logisticsShipments.transportMode,
        originCity: logisticsShipments.originCity,
        originCountry: logisticsShipments.originCountry,
        destinationCity: logisticsShipments.destinationCity,
        destinationCountry: logisticsShipments.destinationCountry,
        destinationWarehouse: logisticsShipments.destinationWarehouse,
        carrierName: logisticsShipments.carrierName,
        eta: logisticsShipments.eta,
        // Derive case/bottle totals from line items (authoritative); the
        // denormalized header counters have drifted (and are NULL for
        // Hillebrand-imported shipments), so only fall back to them when a
        // shipment has no items yet.
        totalCases: sql<number>`COALESCE((
          SELECT SUM(${logisticsShipmentItems.cases})
          FROM ${logisticsShipmentItems}
          WHERE ${logisticsShipmentItems.shipmentId} = ${logisticsShipments.id}
        ), ${logisticsShipments.totalCases}, 0)`,
        totalBottles: sql<number>`COALESCE((
          SELECT SUM(COALESCE(
            ${logisticsShipmentItems.totalBottles},
            ${logisticsShipmentItems.cases} * COALESCE(${logisticsShipmentItems.bottlesPerCase}, 12)
          ))
          FROM ${logisticsShipmentItems}
          WHERE ${logisticsShipmentItems.shipmentId} = ${logisticsShipments.id}
        ), ${logisticsShipments.totalBottles}, 0)`,
        createdAt: logisticsShipments.createdAt,
        jobNumber: logisticsJobs.jobNumber,
        partyName: partyNameSql,
        partyLogoUrl: partyLogoSql,
      })
      .from(logisticsShipments)
      .leftJoin(logisticsJobs, eq(logisticsJobs.shipmentId, logisticsShipments.id))
      // Finished shipments drop off a week after they finish, so the list is live work
      .where(
        sql`NOT (${logisticsShipments.status} IN ('delivered', 'cancelled')
          AND COALESCE(${logisticsShipments.deliveredAt}, ${logisticsShipments.updatedAt}) < ${sevenDaysAgo.toISOString()}::timestamp)`,
      )
      .orderBy(desc(logisticsShipments.createdAt))
      .limit(20),

    // Required docs count
    db
      .select({ count: count() })
      .from(logisticsDocuments)
      .where(eq(logisticsDocuments.isRequired, true)),

    // Verified docs count
    db
      .select({ count: count() })
      .from(logisticsDocuments)
      .where(and(eq(logisticsDocuments.isRequired, true), eq(logisticsDocuments.isVerified, true))),

    // Expiring docs count
    db
      .select({ count: count() })
      .from(logisticsDocuments)
      .where(
        and(
          isNotNull(logisticsDocuments.expiryDate),
          lt(logisticsDocuments.expiryDate, sevenDaysFromNow),
          gte(logisticsDocuments.expiryDate, now),
        ),
      ),

    // Expired docs count
    db
      .select({ count: count() })
      .from(logisticsDocuments)
      .where(and(isNotNull(logisticsDocuments.expiryDate), lt(logisticsDocuments.expiryDate, now))),

    // Monthly costs
    db
      .select({
        totalFreight: sum(logisticsShipments.freightCostUsd),
        totalLanded: sum(
          sql`COALESCE(${logisticsShipments.freightCostUsd}, 0) +
              COALESCE(${logisticsShipments.insuranceCostUsd}, 0) +
              COALESCE(${logisticsShipments.originHandlingUsd}, 0) +
              COALESCE(${logisticsShipments.destinationHandlingUsd}, 0) +
              COALESCE(${logisticsShipments.customsClearanceUsd}, 0) +
              COALESCE(${logisticsShipments.govFeesUsd}, 0) +
              COALESCE(${logisticsShipments.deliveryCostUsd}, 0) +
              COALESCE(${logisticsShipments.otherCostsUsd}, 0)`,
        ),
      })
      .from(logisticsShipments)
      .where(gte(logisticsShipments.createdAt, firstDayOfMonth)),

    // Pending quotes count
    db
      .select({ count: count() })
      .from(logisticsQuotes)
      .where(eq(logisticsQuotes.status, 'pending')),

    // Expiring quotes count
    db
      .select({ count: count() })
      .from(logisticsQuotes)
      .where(
        and(
          eq(logisticsQuotes.status, 'pending'),
          isNotNull(logisticsQuotes.validUntil),
          lt(logisticsQuotes.validUntil, sevenDaysFromNow),
          gte(logisticsQuotes.validUntil, now),
        ),
      ),

    // Recent activity count
    db
      .select({ count: count() })
      .from(logisticsShipments)
      .where(gte(logisticsShipments.createdAt, thirtyDaysAgo)),

    // Pending quote requests count
    db
      .select({ count: count() })
      .from(logisticsQuoteRequests)
      .where(eq(logisticsQuoteRequests.status, 'pending')),

    // In-progress quote requests count
    db
      .select({ count: count() })
      .from(logisticsQuoteRequests)
      .where(eq(logisticsQuoteRequests.status, 'in_progress')),

    // Open requests by the step they wait on; empty if the read fails rather than failing the dashboard
    getOpenQuoteRequestSteps(now).catch(() => []),
  ]);

  // Process shipment status counts
  const statusCounts: Record<string, number> = {};
  for (const row of shipmentsByStatus) {
    statusCounts[row.status] = row.count;
  }

  // Active shipments (not delivered or cancelled)
  const activeCount =
    (statusCounts['draft'] || 0) +
    (statusCounts['booked'] || 0) +
    (statusCounts['picked_up'] || 0) +
    (statusCounts['in_transit'] || 0) +
    (statusCounts['arrived_port'] || 0) +
    (statusCounts['customs_clearance'] || 0) +
    (statusCounts['cleared'] || 0) +
    (statusCounts['at_warehouse'] || 0);

  // Document compliance rate
  const complianceRate =
    requiredDocs[0]?.count && requiredDocs[0].count > 0
      ? Math.round(((verifiedDocs[0]?.count || 0) / requiredDocs[0].count) * 100)
      : 100;

  return {
    shipments: {
      active: activeCount,
      inTransit: statusCounts['in_transit'] || 0,
      arrivedPort: statusCounts['arrived_port'] || 0,
      customsClearance: statusCounts['customs_clearance'] || 0,
      atWarehouse: statusCounts['at_warehouse'] || 0,
      delivered: statusCounts['delivered'] || 0,
      byStatus: statusCounts,
      recentActivityCount: recentActivity[0]?.count || 0,
    },
    recentShipments,
    documents: {
      complianceRate,
      expiringCount: expiringDocs[0]?.count || 0,
      expiredCount: expiredDocs[0]?.count || 0,
      totalRequired: requiredDocs[0]?.count || 0,
      totalVerified: verifiedDocs[0]?.count || 0,
    },
    costs: {
      monthlyFreight: Number(monthlyCosts[0]?.totalFreight) || 0,
      monthlyLanded: Number(monthlyCosts[0]?.totalLanded) || 0,
    },
    quotes: {
      pendingCount: pendingQuotes[0]?.count || 0,
      expiringCount: expiringQuotes[0]?.count || 0,
    },
    quoteRequests: {
      pendingCount: pendingQuoteRequests[0]?.count || 0,
      inProgressCount: inProgressQuoteRequests[0]?.count || 0,
      /** Waiting on forwarders: to send, awaiting reply, or due a chase */
      awaitingRepliesCount: requestSteps.filter((r) =>
        ['choose_forwarders', 'send', 'awaiting', 'chase'].includes(r.nextStep),
      ).length,
      chaseCount: requestSteps.filter((r) => r.nextStep === 'chase').length,
      /** Quotes in: to price for the client, send the price, or accept */
      toPriceCount: requestSteps.filter((r) => ['price', 'send_price', 'accept'].includes(r.nextStep)).length,
    },
  };
});

export default adminGetDashboardMetrics;
