import { and, desc, eq, gte, inArray, lt, not, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  agentOutputs,
  logisticsInvoices,
  privateClientOrders,
  wmsDispatchBatches,
  zohoSalesOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/** USD to AED peg rate */
const USD_TO_AED = 3.6725;

/** Statuses that count as "open" — excludes draft, delivered, cancelled */
const activeStatuses = [
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
] as const;

/**
 * Get all data for the admin Morning View dashboard in a single call.
 * Revenue and financial metrics sourced from Zoho Sales Orders (USD).
 * Runs queries in parallel for performance.
 */
const adminGetMorningView = adminProcedure.query(async () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    openOrdersResult,
    openOrdersThisWeekResult,
    revenueMonthResult,
    revenueLastMonthResult,
    pendingDispatchResult,
    stagedResult,
    overdueResult,
    scoutBrief,
    conciergeBrief,
    storytellerBrief,
    recentPco,
    recentZoho,
  ] = await Promise.all([
    // 1. Open orders count (PCO — operational metric)
    db
      .select({ count: sql<number>`count(*)` })
      .from(privateClientOrders)
      .where(inArray(privateClientOrders.status, activeStatuses))
      .then((r) => r[0]),

    // 2. Open orders created this week (PCO — operational metric)
    db
      .select({ count: sql<number>`count(*)` })
      .from(privateClientOrders)
      .where(
        and(
          inArray(privateClientOrders.status, activeStatuses),
          gte(privateClientOrders.createdAt, sevenDaysAgo),
        ),
      )
      .then((r) => r[0]),

    // 3. Revenue this month (Zoho — USD, source of truth for financials)
    db
      .select({
        total: sql<number>`coalesce(sum(${zohoSalesOrders.total}), 0)`,
      })
      .from(zohoSalesOrders)
      .where(
        and(
          not(inArray(zohoSalesOrders.status, ['cancelled'])),
          gte(zohoSalesOrders.createdAt, thirtyDaysAgo),
        ),
      )
      .then((r) => r[0]),

    // 4. Revenue last month (Zoho — USD, for delta %)
    db
      .select({
        total: sql<number>`coalesce(sum(${zohoSalesOrders.total}), 0)`,
      })
      .from(zohoSalesOrders)
      .where(
        and(
          not(inArray(zohoSalesOrders.status, ['cancelled'])),
          gte(zohoSalesOrders.createdAt, sixtyDaysAgo),
          lt(zohoSalesOrders.createdAt, thirtyDaysAgo),
        ),
      )
      .then((r) => r[0]),

    // 5. Pending dispatch (draft + picking + staged)
    db
      .select({ count: sql<number>`count(*)` })
      .from(wmsDispatchBatches)
      .where(inArray(wmsDispatchBatches.status, ['draft', 'picking', 'staged']))
      .then((r) => r[0]),

    // 6. Staged batches only
    db
      .select({ count: sql<number>`count(*)` })
      .from(wmsDispatchBatches)
      .where(eq(wmsDispatchBatches.status, 'staged'))
      .then((r) => r[0]),

    // 7. Overdue logistics invoices (USD)
    db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<number>`coalesce(sum(${logisticsInvoices.openAmount}), 0)`,
      })
      .from(logisticsInvoices)
      .where(eq(logisticsInvoices.status, 'overdue'))
      .then((r) => r[0]),

    // 8. Latest Scout brief
    db
      .select()
      .from(agentOutputs)
      .where(eq(agentOutputs.agentId, 'scout'))
      .orderBy(desc(agentOutputs.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null),

    // 9. Latest Concierge brief
    db
      .select()
      .from(agentOutputs)
      .where(eq(agentOutputs.agentId, 'concierge'))
      .orderBy(desc(agentOutputs.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null),

    // 10. Latest Storyteller brief
    db
      .select()
      .from(agentOutputs)
      .where(eq(agentOutputs.agentId, 'storyteller'))
      .orderBy(desc(agentOutputs.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null),

    // 11. Recent PCO orders (5)
    db
      .select({
        id: privateClientOrders.id,
        orderNumber: privateClientOrders.orderNumber,
        customerName: privateClientOrders.clientName,
        totalUsd: privateClientOrders.totalUsd,
        totalAed: privateClientOrders.totalAed,
        status: privateClientOrders.status,
        createdAt: privateClientOrders.createdAt,
      })
      .from(privateClientOrders)
      .where(
        not(inArray(privateClientOrders.status, ['draft', 'cancelled'])),
      )
      .orderBy(desc(privateClientOrders.createdAt))
      .limit(5),

    // 12. Recent Zoho orders (5)
    db
      .select({
        id: zohoSalesOrders.id,
        orderNumber: zohoSalesOrders.salesOrderNumber,
        customerName: zohoSalesOrders.customerName,
        totalUsd: zohoSalesOrders.total,
        status: zohoSalesOrders.status,
        createdAt: zohoSalesOrders.createdAt,
      })
      .from(zohoSalesOrders)
      .orderBy(desc(zohoSalesOrders.createdAt))
      .limit(5),
  ]);

  // Parse agent brief data safely
  const parseBrief = (
    brief: typeof scoutBrief,
    agentId: string,
  ) => {
    if (!brief) return null;

    const data = brief.data as Record<string, unknown> | null;
    const summary =
      typeof data?.executiveSummary === 'string'
        ? data.executiveSummary
        : '';

    let highlight = '';
    if (agentId === 'scout') {
      const priceGaps = Array.isArray(data?.priceGaps)
        ? data.priceGaps
        : [];
      const actionItems = Array.isArray(data?.actionItems)
        ? data.actionItems
        : [];
      highlight = priceGaps.length > 0
        ? `${priceGaps.length} price gaps detected`
        : `${actionItems.length} action items`;
    } else if (agentId === 'concierge') {
      const hotLeads = Array.isArray(data?.hotLeads)
        ? data.hotLeads
        : [];
      highlight = `${hotLeads.length} clients need outreach`;
    } else if (agentId === 'storyteller') {
      const posts = Array.isArray(data?.instagramPosts)
        ? data.instagramPosts
        : [];
      highlight = posts.length > 0
        ? `${posts.length} posts ready`
        : 'Weekly content ready';
    }

    return {
      agentId,
      title: brief.title,
      summary,
      highlight,
      createdAt: brief.createdAt,
    };
  };

  // Count high-priority Scout action items for KPI
  const scoutData = scoutBrief?.data as Record<string, unknown> | null;
  const actionItems = Array.isArray(scoutData?.actionItems)
    ? scoutData.actionItems
    : [];
  const highPriorityAlerts = actionItems.filter(
    (item: unknown) =>
      typeof item === 'object' &&
      item !== null &&
      'priority' in item &&
      (item as { priority: string }).priority === 'high',
  ).length;

  // Revenue in USD (source of truth) and AED (converted at peg rate)
  const revenueMonthUsd = Number(revenueMonthResult?.total ?? 0);
  const revenueLastMonthUsd = Number(revenueLastMonthResult?.total ?? 0);

  // Merge + sort recent orders (both currencies for toggle)
  const mergedOrders = [
    ...recentPco.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber ?? '',
      source: 'pco' as const,
      customerName: o.customerName ?? '',
      totalUsd: o.totalUsd,
      totalAed: o.totalAed ?? o.totalUsd * USD_TO_AED,
      status: o.status ?? '',
      createdAt: o.createdAt,
    })),
    ...recentZoho.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber ?? '',
      source: 'zoho' as const,
      customerName: o.customerName ?? '',
      totalUsd: o.totalUsd,
      totalAed: o.totalUsd * USD_TO_AED,
      status: o.status ?? '',
      createdAt: o.createdAt,
    })),
  ]
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  // Build agent briefs array
  const agentBriefs = [
    parseBrief(scoutBrief, 'scout'),
    parseBrief(conciergeBrief, 'concierge'),
    parseBrief(storytellerBrief, 'storyteller'),
  ].filter(Boolean);

  return {
    kpis: {
      openOrders: Number(openOrdersResult?.count ?? 0),
      openOrdersThisWeek: Number(openOrdersThisWeekResult?.count ?? 0),
      revenueMonthUsd,
      revenueMonthAed: revenueMonthUsd * USD_TO_AED,
      revenueLastMonthUsd,
      revenueLastMonthAed: revenueLastMonthUsd * USD_TO_AED,
      pendingDispatch: Number(pendingDispatchResult?.count ?? 0),
      stagedBatches: Number(stagedResult?.count ?? 0),
      agentAlerts: highPriorityAlerts,
      overdueInvoices: Number(overdueResult?.count ?? 0),
      overdueAmountUsd: Number(overdueResult?.totalAmount ?? 0),
      overdueAmountAed: Number(overdueResult?.totalAmount ?? 0) * USD_TO_AED,
    },
    agentBriefs,
    recentOrders: mergedOrders,
  };
});

export default adminGetMorningView;
