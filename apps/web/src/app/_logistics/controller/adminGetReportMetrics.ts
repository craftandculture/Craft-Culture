import { and, count, eq, gte, isNotNull, lt, sql, sum } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsDocuments, logisticsInvoices, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get comprehensive logistics report metrics
 *
 * Returns aggregated statistics for the dashboard including:
 * - Shipment counts by status and type
 * - Document compliance rates
 * - Invoice totals and aging
 * - Cost summaries
 */
const adminGetReportMetrics = adminProcedure.query(async () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Shipment counts by status
  const shipmentsByStatus = await db
    .select({
      status: logisticsShipments.status,
      count: count(),
    })
    .from(logisticsShipments)
    .groupBy(logisticsShipments.status);

  // Shipment counts by type
  const shipmentsByType = await db
    .select({
      shipmentType: logisticsShipments.type,
      count: count(),
    })
    .from(logisticsShipments)
    .groupBy(logisticsShipments.type);

  // Shipment counts by transport mode
  const shipmentsByTransportMode = await db
    .select({
      transportMode: logisticsShipments.transportMode,
      count: count(),
    })
    .from(logisticsShipments)
    .groupBy(logisticsShipments.transportMode);

  // Total shipments and recent activity
  const totalShipments = await db.select({ count: count() }).from(logisticsShipments);

  const recentShipments = await db
    .select({ count: count() })
    .from(logisticsShipments)
    .where(gte(logisticsShipments.createdAt, thirtyDaysAgo));

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

  // Invoice metrics
  const invoiceMetrics = await db
    .select({
      status: logisticsInvoices.status,
      count: count(),
      totalAmount: sum(logisticsInvoices.totalAmount),
      openAmount: sum(logisticsInvoices.openAmount),
    })
    .from(logisticsInvoices)
    .groupBy(logisticsInvoices.status);

  // Cost summaries (from shipments)
  const costSummary = await db
    .select({
      totalFreight: sum(logisticsShipments.freightCostUsd),
      totalInsurance: sum(logisticsShipments.insuranceCostUsd),
      totalHandling: sum(
        sql`COALESCE(${logisticsShipments.originHandlingUsd}, 0) + COALESCE(${logisticsShipments.destinationHandlingUsd}, 0)`,
      ),
      totalCustoms: sum(logisticsShipments.customsClearanceUsd),
      totalGovFees: sum(logisticsShipments.govFeesUsd),
      totalDelivery: sum(logisticsShipments.deliveryCostUsd),
      totalOther: sum(logisticsShipments.otherCostsUsd),
    })
    .from(logisticsShipments);

  // Calculate totals
  const statusCounts: Record<string, number> = {};
  for (const row of shipmentsByStatus) {
    statusCounts[row.status] = row.count;
  }

  const typeCounts: Record<string, number> = {};
  for (const row of shipmentsByType) {
    typeCounts[row.shipmentType] = row.count;
  }

  const transportModeCounts: Record<string, number> = {};
  for (const row of shipmentsByTransportMode) {
    transportModeCounts[row.transportMode] = row.count;
  }

  const invoiceTotals: Record<
    string,
    { count: number; totalAmount: number; openAmount: number }
  > = {};
  for (const row of invoiceMetrics) {
    invoiceTotals[row.status] = {
      count: row.count,
      totalAmount: Number(row.totalAmount) || 0,
      openAmount: Number(row.openAmount) || 0,
    };
  }

  const costs = costSummary[0];

  return {
    shipments: {
      total: totalShipments[0]?.count || 0,
      recentCount: recentShipments[0]?.count || 0,
      byStatus: statusCounts,
      byType: typeCounts,
      byTransportMode: transportModeCounts,
    },
    documents: {
      requiredCount: requiredDocs[0]?.count || 0,
      verifiedCount: verifiedDocs[0]?.count || 0,
      complianceRate:
        requiredDocs[0]?.count && requiredDocs[0].count > 0
          ? Math.round(((verifiedDocs[0]?.count || 0) / requiredDocs[0].count) * 100)
          : 100,
      expiringCount: expiringDocs[0]?.count || 0,
      expiredCount: expiredDocs[0]?.count || 0,
    },
    invoices: {
      byStatus: invoiceTotals,
      totalOpen:
        Object.values(invoiceTotals).reduce((sum, inv) => sum + inv.openAmount, 0),
      totalCount: Object.values(invoiceTotals).reduce((sum, inv) => sum + inv.count, 0),
    },
    costs: {
      freight: Number(costs?.totalFreight) || 0,
      insurance: Number(costs?.totalInsurance) || 0,
      handling: Number(costs?.totalHandling) || 0,
      customs: Number(costs?.totalCustoms) || 0,
      governmentFees: Number(costs?.totalGovFees) || 0,
      delivery: Number(costs?.totalDelivery) || 0,
      other: Number(costs?.totalOther) || 0,
      total:
        (Number(costs?.totalFreight) || 0) +
        (Number(costs?.totalInsurance) || 0) +
        (Number(costs?.totalHandling) || 0) +
        (Number(costs?.totalCustoms) || 0) +
        (Number(costs?.totalGovFees) || 0) +
        (Number(costs?.totalDelivery) || 0) +
        (Number(costs?.totalOther) || 0),
    },
  };
});

export default adminGetReportMetrics;
