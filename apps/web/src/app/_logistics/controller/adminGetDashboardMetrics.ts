import { and, count, desc, eq, gte, isNotNull, lt, sql, sum } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsDocuments,
  logisticsQuotes,
  logisticsShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

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
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Shipment counts by status
  const shipmentsByStatus = await db
    .select({
      status: logisticsShipments.status,
      count: count(),
    })
    .from(logisticsShipments)
    .groupBy(logisticsShipments.status);

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
    (statusCounts['at_warehouse'] || 0) +
    (statusCounts['dispatched'] || 0);

  // Recent shipments (top 10)
  const recentShipments = await db.query.logisticsShipments.findMany({
    orderBy: [desc(logisticsShipments.createdAt)],
    limit: 10,
    columns: {
      id: true,
      shipmentNumber: true,
      status: true,
      type: true,
      transportMode: true,
      originCity: true,
      originCountry: true,
      destinationCity: true,
      destinationCountry: true,
      destinationWarehouse: true,
      carrierName: true,
      eta: true,
      totalCases: true,
      createdAt: true,
    },
  });

  // Document compliance metrics
  const requiredDocs = await db
    .select({ count: count() })
    .from(logisticsDocuments)
    .where(eq(logisticsDocuments.isRequired, true));

  const verifiedDocs = await db
    .select({ count: count() })
    .from(logisticsDocuments)
    .where(and(eq(logisticsDocuments.isRequired, true), eq(logisticsDocuments.isVerified, true)));

  const expiringDocs = await db
    .select({ count: count() })
    .from(logisticsDocuments)
    .where(
      and(
        isNotNull(logisticsDocuments.expiryDate),
        lt(logisticsDocuments.expiryDate, sevenDaysFromNow),
        gte(logisticsDocuments.expiryDate, now),
      ),
    );

  const expiredDocs = await db
    .select({ count: count() })
    .from(logisticsDocuments)
    .where(and(isNotNull(logisticsDocuments.expiryDate), lt(logisticsDocuments.expiryDate, now)));

  // Document compliance rate
  const complianceRate =
    requiredDocs[0]?.count && requiredDocs[0].count > 0
      ? Math.round(((verifiedDocs[0]?.count || 0) / requiredDocs[0].count) * 100)
      : 100;

  // Cost summary for this month
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyCosts = await db
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
    .where(gte(logisticsShipments.createdAt, firstDayOfMonth));

  // Pending quotes count
  const pendingQuotes = await db
    .select({ count: count() })
    .from(logisticsQuotes)
    .where(eq(logisticsQuotes.status, 'pending'));

  // Quotes needing attention (expiring within 7 days)
  const expiringQuotes = await db
    .select({ count: count() })
    .from(logisticsQuotes)
    .where(
      and(
        eq(logisticsQuotes.status, 'pending'),
        isNotNull(logisticsQuotes.validUntil),
        lt(logisticsQuotes.validUntil, sevenDaysFromNow),
        gte(logisticsQuotes.validUntil, now),
      ),
    );

  // Shipments created in last 30 days
  const recentActivity = await db
    .select({ count: count() })
    .from(logisticsShipments)
    .where(gte(logisticsShipments.createdAt, thirtyDaysAgo));

  return {
    shipments: {
      active: activeCount,
      inTransit: statusCounts['in_transit'] || 0,
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
  };
});

export default adminGetDashboardMetrics;
