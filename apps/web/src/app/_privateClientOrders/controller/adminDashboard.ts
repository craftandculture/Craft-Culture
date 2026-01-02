import { and, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  partners,
  privateClientOrderClients,
  privateClientOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get dashboard statistics for admin users
 *
 * Returns KPIs including order counts by status, recent orders,
 * orders by partner, and aggregated metrics for the admin dashboard.
 */
const adminDashboard = adminProcedure.query(async () => {
  // Get date 30 days ago for "this month" metrics
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // All statuses except draft and cancelled
  const activeStatuses = [
    'submitted',
    'under_review',
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
  ] as const;

  // Get counts by status
  const statusCounts = await db
    .select({
      status: privateClientOrders.status,
      count: sql<number>`count(*)`,
    })
    .from(privateClientOrders)
    .groupBy(privateClientOrders.status);

  // Get totals for active orders
  const [totals] = await db
    .select({
      totalOrders: sql<number>`count(*)`,
      totalCases: sql<number>`coalesce(sum(${privateClientOrders.caseCount}), 0)`,
      totalValueUsd: sql<number>`coalesce(sum(${privateClientOrders.totalUsd}), 0)`,
      totalValueAed: sql<number>`coalesce(sum(${privateClientOrders.totalAed}), 0)`,
    })
    .from(privateClientOrders)
    .where(inArray(privateClientOrders.status, activeStatuses));

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
        inArray(privateClientOrders.status, activeStatuses),
        gte(privateClientOrders.createdAt, thirtyDaysAgo),
      ),
    );

  // Get pending approvals count
  const [pendingApprovals] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(privateClientOrders)
    .where(
      inArray(privateClientOrders.status, ['submitted', 'under_review']),
    );

  // Get recent 8 orders with partner info
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
    .orderBy(desc(privateClientOrders.createdAt))
    .limit(8);

  // Get orders by partner breakdown
  const ordersByPartner = await db
    .select({
      partnerId: partners.id,
      partnerName: partners.businessName,
      partnerLogoUrl: partners.logoUrl,
      orderCount: sql<number>`count(*)`,
      activeCount: sql<number>`sum(case when ${privateClientOrders.status} not in ('draft', 'cancelled', 'delivered') then 1 else 0 end)`,
      totalCases: sql<number>`coalesce(sum(${privateClientOrders.caseCount}), 0)`,
      totalValueUsd: sql<number>`coalesce(sum(${privateClientOrders.totalUsd}), 0)`,
      totalValueAed: sql<number>`coalesce(sum(${privateClientOrders.totalAed}), 0)`,
    })
    .from(privateClientOrders)
    .leftJoin(partners, eq(privateClientOrders.partnerId, partners.id))
    .where(isNotNull(privateClientOrders.partnerId))
    .groupBy(partners.id, partners.businessName, partners.logoUrl)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  // Get verified clients count
  const [verifiedClientsCount] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(privateClientOrderClients)
    .where(isNotNull(privateClientOrderClients.cityDrinksVerifiedAt));

  // Build status breakdown for pipeline
  const pendingReviewStatuses = ['submitted', 'under_review', 'revision_requested'];
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
    kpis: {
      totalOrders: Number(totals?.totalOrders ?? 0),
      totalCases: Number(totals?.totalCases ?? 0),
      totalValueUsd: Number(totals?.totalValueUsd ?? 0),
      totalValueAed: Number(totals?.totalValueAed ?? 0),
      monthlyOrders: Number(monthlyTotals?.totalOrders ?? 0),
      monthlyCases: Number(monthlyTotals?.totalCases ?? 0),
      monthlyValueUsd: Number(monthlyTotals?.totalValueUsd ?? 0),
      monthlyValueAed: Number(monthlyTotals?.totalValueAed ?? 0),
      pendingApprovals: Number(pendingApprovals?.count ?? 0),
      verifiedClients: Number(verifiedClientsCount?.count ?? 0),
    },
    statusBreakdown: {
      drafts: countByStatuses(['draft']),
      pendingReview: countByStatuses(pendingReviewStatuses),
      awaitingVerification: countByStatuses(awaitingVerificationStatuses),
      awaitingPayment: countByStatuses(awaitingPaymentStatuses),
      inFulfillment: countByStatuses(inFulfillmentStatuses),
      completed: countByStatuses(completedStatuses),
      cancelled: countByStatuses(['cancelled']),
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
      activeCount: Number(p.activeCount),
      totalCases: Number(p.totalCases),
      totalValueUsd: Number(p.totalValueUsd),
      totalValueAed: Number(p.totalValueAed),
    })),
  };
});

export default adminDashboard;
