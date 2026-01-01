import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import { partners, privateClientOrders } from '@/database/schema';
import { distributorProcedure } from '@/lib/trpc/procedures';

/**
 * Get dashboard statistics for the current distributor
 *
 * Returns KPIs including order counts by status, recent orders,
 * and aggregated metrics for displaying on the distributor dashboard.
 */
const distributorDashboard = distributorProcedure.query(
  async ({ ctx: { partnerId } }) => {
    // Get date 30 days ago for "this month" metrics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Status categories for distributors
    const visibleStatuses = [
      'cc_approved',
      'awaiting_client_payment',
      'client_paid',
      'awaiting_distributor_payment',
      'distributor_paid',
      'awaiting_partner_payment',
      'partner_paid',
      'stock_in_transit',
      'with_distributor',
      'out_for_delivery',
      'delivered',
    ] as const;

    // Get counts by status
    const statusCounts = await db
      .select({
        status: privateClientOrders.status,
        count: sql<number>`count(*)`,
      })
      .from(privateClientOrders)
      .where(
        and(
          eq(privateClientOrders.distributorId, partnerId),
          inArray(privateClientOrders.status, visibleStatuses),
        ),
      )
      .groupBy(privateClientOrders.status);

    // Get totals (both USD and AED)
    const [totals] = await db
      .select({
        totalOrders: sql<number>`count(*)`,
        totalCases: sql<number>`coalesce(sum(${privateClientOrders.caseCount}), 0)`,
        totalValueUsd: sql<number>`coalesce(sum(${privateClientOrders.totalUsd}), 0)`,
        totalValueAed: sql<number>`coalesce(sum(${privateClientOrders.totalAed}), 0)`,
      })
      .from(privateClientOrders)
      .where(
        and(
          eq(privateClientOrders.distributorId, partnerId),
          inArray(privateClientOrders.status, visibleStatuses),
        ),
      );

    // Get this month's totals (both USD and AED)
    const [monthlyTotals] = await db
      .select({
        totalOrders: sql<number>`count(*)`,
        totalCases: sql<number>`coalesce(sum(${privateClientOrders.caseCount}), 0)`,
        totalValueUsd: sql<number>`coalesce(sum(${privateClientOrders.totalUsd}), 0)`,
        totalValueAed: sql<number>`coalesce(sum(${privateClientOrders.totalAed}), 0)`,
      })
      .from(privateClientOrders)
      .where(
        and(
          eq(privateClientOrders.distributorId, partnerId),
          inArray(privateClientOrders.status, visibleStatuses),
          gte(privateClientOrders.distributorAssignedAt, thirtyDaysAgo),
        ),
      );

    // Get recent 5 orders with partner info
    const recentOrders = await db
      .select({
        order: privateClientOrders,
        partner: {
          id: partners.id,
          businessName: partners.businessName,
          logoUrl: partners.logoUrl,
        },
      })
      .from(privateClientOrders)
      .leftJoin(partners, eq(privateClientOrders.partnerId, partners.id))
      .where(
        and(
          eq(privateClientOrders.distributorId, partnerId),
          inArray(privateClientOrders.status, visibleStatuses),
        ),
      )
      .orderBy(desc(privateClientOrders.distributorAssignedAt))
      .limit(5);

    // Get orders by partner for breakdown (both USD and AED)
    const ordersByPartner = await db
      .select({
        partnerId: partners.id,
        partnerName: partners.businessName,
        partnerLogoUrl: partners.logoUrl,
        orderCount: sql<number>`count(*)`,
        totalCases: sql<number>`coalesce(sum(${privateClientOrders.caseCount}), 0)`,
        totalValueUsd: sql<number>`coalesce(sum(${privateClientOrders.totalUsd}), 0)`,
        totalValueAed: sql<number>`coalesce(sum(${privateClientOrders.totalAed}), 0)`,
      })
      .from(privateClientOrders)
      .leftJoin(partners, eq(privateClientOrders.partnerId, partners.id))
      .where(
        and(
          eq(privateClientOrders.distributorId, partnerId),
          inArray(privateClientOrders.status, visibleStatuses),
        ),
      )
      .groupBy(partners.id, partners.businessName, partners.logoUrl);

    // Build status breakdown with proper categorization
    const pendingPaymentStatuses = [
      'cc_approved',
      'awaiting_client_payment',
      'client_paid',
      'awaiting_distributor_payment',
    ];
    const inTransitStatuses = ['distributor_paid', 'stock_in_transit'];
    const atWarehouseStatuses = ['with_distributor'];
    const inDeliveryStatuses = ['out_for_delivery'];
    const completedStatuses = ['delivered'];

    const countByStatuses = (statuses: string[]) =>
      statusCounts
        .filter((s) => statuses.includes(s.status))
        .reduce((sum, s) => sum + Number(s.count), 0);

    return {
      kpis: {
        totalOrders: Number(totals?.totalOrders ?? 0),
        totalCases: Number(totals?.totalCases ?? 0),
        totalValueUsd: Number(totals?.totalValueUsd ?? 0),
        totalValueAed: Number(totals?.totalValueAed ?? 0),
        monthlyOrders: Number(monthlyTotals?.totalOrders ?? 0),
        monthlyCases: Number(monthlyTotals?.totalCases ?? 0),
        monthlyValueUsd: Number(monthlyTotals?.totalValueUsd ?? 0),
        monthlyValueAed: Number(monthlyTotals?.totalValueAed ?? 0),
      },
      statusBreakdown: {
        pendingPayment: countByStatuses(pendingPaymentStatuses),
        inTransit: countByStatuses(inTransitStatuses),
        atWarehouse: countByStatuses(atWarehouseStatuses),
        inDelivery: countByStatuses(inDeliveryStatuses),
        completed: countByStatuses(completedStatuses),
      },
      statusCounts: statusCounts.map((s) => ({
        status: s.status,
        count: Number(s.count),
      })),
      recentOrders: recentOrders.map((row) => ({
        ...row.order,
        partner: row.partner,
      })),
      ordersByPartner: ordersByPartner.map((p) => ({
        partnerId: p.partnerId,
        partnerName: p.partnerName ?? 'Unknown Partner',
        partnerLogoUrl: p.partnerLogoUrl,
        orderCount: Number(p.orderCount),
        totalCases: Number(p.totalCases),
        totalValueUsd: Number(p.totalValueUsd),
        totalValueAed: Number(p.totalValueAed),
      })),
    };
  },
);

export default distributorDashboard;
