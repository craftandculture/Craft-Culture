import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import { privateClientContacts, privateClientOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

/**
 * Get dashboard statistics for the current partner (wine company)
 *
 * Returns KPIs including order counts by status, recent orders,
 * client breakdown, and aggregated metrics for the partner dashboard.
 */
const partnerDashboard = winePartnerProcedure.query(
  async ({ ctx: { partnerId } }) => {

  // Get date 30 days ago for "this month" metrics
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Statuses visible to partners
  const visibleStatuses = [
    'draft',
    'submitted',
    'under_cc_review',
    'revision_requested',
    'cc_approved',
    'awaiting_partner_verification',
    'awaiting_distributor_verification',
    'verification_suspended',
    'awaiting_client_payment',
    'client_paid',
    'awaiting_distributor_payment',
    'distributor_paid',
    'awaiting_partner_payment',
    'partner_paid',
    'stock_in_transit',
    'with_distributor',
    'scheduling_delivery',
    'delivery_scheduled',
    'out_for_delivery',
    'delivered',
    'cancelled',
  ] as const;

  // Get counts by status
  const statusCounts = await db
    .select({
      status: privateClientOrders.status,
      count: sql<number>`count(*)`,
    })
    .from(privateClientOrders)
    .where(eq(privateClientOrders.partnerId, partnerId))
    .groupBy(privateClientOrders.status);

  // Get totals (excluding drafts and cancelled)
  const activeStatuses = visibleStatuses.filter(
    (s) => s !== 'draft' && s !== 'cancelled',
  );

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
        eq(privateClientOrders.partnerId, partnerId),
        inArray(privateClientOrders.status, activeStatuses),
      ),
    );

  // Get this month's totals
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
        eq(privateClientOrders.partnerId, partnerId),
        inArray(privateClientOrders.status, activeStatuses),
        gte(privateClientOrders.createdAt, thirtyDaysAgo),
      ),
    );

  // Get recent 8 orders
  const recentOrders = await db
    .select({
      order: privateClientOrders,
      client: {
        id: privateClientContacts.id,
        cityDrinksVerifiedAt: privateClientContacts.cityDrinksVerifiedAt,
      },
    })
    .from(privateClientOrders)
    .leftJoin(
      privateClientContacts,
      eq(privateClientOrders.clientId, privateClientContacts.id),
    )
    .where(eq(privateClientOrders.partnerId, partnerId))
    .orderBy(desc(privateClientOrders.createdAt))
    .limit(8);

  // Get unique clients count
  const [clientsCount] = await db
    .select({
      total: sql<number>`count(distinct ${privateClientOrders.clientName})`,
      verified: sql<number>`count(distinct case when ${privateClientContacts.cityDrinksVerifiedAt} is not null then ${privateClientOrders.clientName} end)`,
    })
    .from(privateClientOrders)
    .leftJoin(
      privateClientContacts,
      eq(privateClientOrders.clientId, privateClientContacts.id),
    )
    .where(eq(privateClientOrders.partnerId, partnerId));

  // Get top clients by order count
  const topClients = await db
    .select({
      clientName: privateClientOrders.clientName,
      clientId: privateClientOrders.clientId,
      orderCount: sql<number>`count(*)`,
      totalCases: sql<number>`coalesce(sum(${privateClientOrders.caseCount}), 0)`,
      totalValueUsd: sql<number>`coalesce(sum(${privateClientOrders.totalUsd}), 0)`,
      totalValueAed: sql<number>`coalesce(sum(${privateClientOrders.totalAed}), 0)`,
      isVerified: sql<boolean>`max(case when ${privateClientContacts.cityDrinksVerifiedAt} is not null then 1 else 0 end) = 1`,
    })
    .from(privateClientOrders)
    .leftJoin(
      privateClientContacts,
      eq(privateClientOrders.clientId, privateClientContacts.id),
    )
    .where(
      and(
        eq(privateClientOrders.partnerId, partnerId),
        inArray(privateClientOrders.status, activeStatuses),
      ),
    )
    .groupBy(privateClientOrders.clientName, privateClientOrders.clientId)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  // Build status breakdown for pipeline
  const draftStatuses = ['draft'];
  const pendingApprovalStatuses = ['submitted', 'under_cc_review', 'revision_requested'];
  const awaitingVerificationStatuses = [
    'cc_approved',
    'awaiting_partner_verification',
    'awaiting_distributor_verification',
    'verification_suspended',
  ];
  const awaitingPaymentStatuses = [
    'awaiting_client_payment',
    'client_paid',
    'awaiting_distributor_payment',
  ];
  const inFulfillmentStatuses = [
    'distributor_paid',
    'awaiting_partner_payment',
    'partner_paid',
    'stock_in_transit',
    'with_distributor',
    'scheduling_delivery',
    'delivery_scheduled',
    'out_for_delivery',
  ];
  const completedStatuses = ['delivered'];

  const countByStatuses = (statuses: string[]) =>
    statusCounts
      .filter((s) => statuses.includes(s.status))
      .reduce((sum, s) => sum + Number(s.count), 0);

  return {
    partnerId,
    kpis: {
      totalOrders: Number(totals?.totalOrders ?? 0),
      totalCases: Number(totals?.totalCases ?? 0),
      totalValueUsd: Number(totals?.totalValueUsd ?? 0),
      totalValueAed: Number(totals?.totalValueAed ?? 0),
      monthlyOrders: Number(monthlyTotals?.totalOrders ?? 0),
      monthlyCases: Number(monthlyTotals?.totalCases ?? 0),
      monthlyValueUsd: Number(monthlyTotals?.totalValueUsd ?? 0),
      monthlyValueAed: Number(monthlyTotals?.totalValueAed ?? 0),
      totalClients: Number(clientsCount?.total ?? 0),
      verifiedClients: Number(clientsCount?.verified ?? 0),
    },
    statusBreakdown: {
      drafts: countByStatuses(draftStatuses),
      pendingApproval: countByStatuses(pendingApprovalStatuses),
      awaitingVerification: countByStatuses(awaitingVerificationStatuses),
      awaitingPayment: countByStatuses(awaitingPaymentStatuses),
      inFulfillment: countByStatuses(inFulfillmentStatuses),
      completed: countByStatuses(completedStatuses),
    },
    statusCounts: statusCounts.map((s) => ({
      status: s.status,
      count: Number(s.count),
    })),
    recentOrders: recentOrders.map((row) => ({
      ...row.order,
      client: row.client,
    })),
    topClients: topClients.map((c) => ({
      clientName: c.clientName,
      clientId: c.clientId,
      orderCount: Number(c.orderCount),
      totalCases: Number(c.totalCases),
      totalValueUsd: Number(c.totalValueUsd),
      totalValueAed: Number(c.totalValueAed),
      isVerified: Boolean(c.isVerified),
    })),
  };
  },
);

export default partnerDashboard;
