import { and, desc, eq, gte, inArray, lt, not, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  agentOutputs,
  privateClientOrders,
  wmsDispatchBatches,
  zohoInvoices,
  zohoSalesOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/** USD to AED peg rate */
const USD_TO_AED = 3.6725;

/** Invoice statuses that represent real revenue (exclude draft/void) */
const revenueStatuses = ['sent', 'viewed', 'overdue', 'paid', 'partially_paid'];

/** Statuses that count as "open" PCO — excludes draft, delivered, cancelled */
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
 * Revenue and financial metrics sourced from Zoho invoiced orders (USD).
 * Runs queries in parallel for performance.
 */
const adminGetMorningView = adminProcedure.query(async () => {
  const now = new Date();

  // Calendar month boundaries
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = thisMonthStart;

  // Calendar year boundaries (compare same period YTD)
  const thisYearStart = new Date(now.getFullYear(), 0, 1);
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const lastYearEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    openOrdersResult,
    openOrdersThisWeekResult,
    revenueThisMonth,
    revenueLastMonth,
    revenueThisYear,
    revenueLastYear,
    pendingDispatchResult,
    stagedResult,
    overdueResult,
    scoutBrief,
    conciergeBrief,
    storytellerBrief,
    buyerBrief,
    pricerBrief,
    advisorBrief,
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

    // 3. Revenue this calendar month (Zoho invoices, normalized to USD)
    db
      .select({
        total: sql<number>`coalesce(sum(CASE WHEN ${zohoInvoices.currencyCode} = 'AED' THEN ${zohoInvoices.total} / ${USD_TO_AED} ELSE ${zohoInvoices.total} END), 0)`,
      })
      .from(zohoInvoices)
      .where(
        and(
          inArray(zohoInvoices.status, revenueStatuses),
          gte(zohoInvoices.invoiceDate, thisMonthStart),
        ),
      )
      .then((r) => r[0]),

    // 4. Revenue last calendar month (Zoho invoices, normalized to USD)
    db
      .select({
        total: sql<number>`coalesce(sum(CASE WHEN ${zohoInvoices.currencyCode} = 'AED' THEN ${zohoInvoices.total} / ${USD_TO_AED} ELSE ${zohoInvoices.total} END), 0)`,
      })
      .from(zohoInvoices)
      .where(
        and(
          inArray(zohoInvoices.status, revenueStatuses),
          gte(zohoInvoices.invoiceDate, lastMonthStart),
          lt(zohoInvoices.invoiceDate, lastMonthEnd),
        ),
      )
      .then((r) => r[0]),

    // 5. Revenue this calendar year (Zoho invoices, normalized to USD)
    db
      .select({
        total: sql<number>`coalesce(sum(CASE WHEN ${zohoInvoices.currencyCode} = 'AED' THEN ${zohoInvoices.total} / ${USD_TO_AED} ELSE ${zohoInvoices.total} END), 0)`,
      })
      .from(zohoInvoices)
      .where(
        and(
          inArray(zohoInvoices.status, revenueStatuses),
          gte(zohoInvoices.invoiceDate, thisYearStart),
        ),
      )
      .then((r) => r[0]),

    // 6. Revenue same period last year (Zoho invoices, normalized to USD)
    db
      .select({
        total: sql<number>`coalesce(sum(CASE WHEN ${zohoInvoices.currencyCode} = 'AED' THEN ${zohoInvoices.total} / ${USD_TO_AED} ELSE ${zohoInvoices.total} END), 0)`,
      })
      .from(zohoInvoices)
      .where(
        and(
          inArray(zohoInvoices.status, revenueStatuses),
          gte(zohoInvoices.invoiceDate, lastYearStart),
          lt(zohoInvoices.invoiceDate, lastYearEnd),
        ),
      )
      .then((r) => r[0]),

    // 7. Pending dispatch (draft + picking + staged)
    db
      .select({ count: sql<number>`count(*)` })
      .from(wmsDispatchBatches)
      .where(inArray(wmsDispatchBatches.status, ['draft', 'picking', 'staged']))
      .then((r) => r[0]),

    // 8. Staged batches only
    db
      .select({ count: sql<number>`count(*)` })
      .from(wmsDispatchBatches)
      .where(eq(wmsDispatchBatches.status, 'staged'))
      .then((r) => r[0]),

    // 9. Overdue invoices (Zoho invoices with status = 'overdue')
    db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<number>`coalesce(sum(CASE WHEN ${zohoInvoices.currencyCode} = 'AED' THEN ${zohoInvoices.balance} / ${USD_TO_AED} ELSE ${zohoInvoices.balance} END), 0)`,
      })
      .from(zohoInvoices)
      .where(eq(zohoInvoices.status, 'overdue'))
      .then((r) => r[0]),

    // 10. Latest Scout brief
    db
      .select()
      .from(agentOutputs)
      .where(eq(agentOutputs.agentId, 'scout'))
      .orderBy(desc(agentOutputs.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null),

    // 11. Latest Concierge brief
    db
      .select()
      .from(agentOutputs)
      .where(eq(agentOutputs.agentId, 'concierge'))
      .orderBy(desc(agentOutputs.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null),

    // 12. Latest Storyteller brief
    db
      .select()
      .from(agentOutputs)
      .where(eq(agentOutputs.agentId, 'storyteller'))
      .orderBy(desc(agentOutputs.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null),

    // 13. Latest Buyer brief
    db
      .select()
      .from(agentOutputs)
      .where(eq(agentOutputs.agentId, 'buyer'))
      .orderBy(desc(agentOutputs.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null),

    // 14. Latest Pricer brief
    db
      .select()
      .from(agentOutputs)
      .where(eq(agentOutputs.agentId, 'pricer'))
      .orderBy(desc(agentOutputs.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null),

    // 15. Latest Advisor brief
    db
      .select()
      .from(agentOutputs)
      .where(eq(agentOutputs.agentId, 'advisor'))
      .orderBy(desc(agentOutputs.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null),

    // 16. Recent PCO orders (5)
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

    // 14. Recent Zoho orders (5)
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
    } else if (agentId === 'buyer') {
      const reorderAlerts = Array.isArray(data?.reorderAlerts)
        ? data.reorderAlerts
        : [];
      highlight = `${reorderAlerts.length} reorder alerts`;
    } else if (agentId === 'pricer') {
      const priceAdjustments = Array.isArray(data?.priceAdjustments)
        ? data.priceAdjustments
        : [];
      highlight = `${priceAdjustments.length} price suggestions`;
    } else if (agentId === 'advisor') {
      const risks = Array.isArray(data?.risks) ? data.risks : [];
      highlight = `${risks.length} risks flagged`;
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

  // Revenue figures in USD
  const monthUsd = Number(revenueThisMonth?.total ?? 0);
  const lastMonthUsd = Number(revenueLastMonth?.total ?? 0);
  const yearUsd = Number(revenueThisYear?.total ?? 0);
  const lastYearUsd = Number(revenueLastYear?.total ?? 0);
  const overdueUsd = Number(overdueResult?.totalAmount ?? 0);

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
    parseBrief(buyerBrief, 'buyer'),
    parseBrief(pricerBrief, 'pricer'),
    parseBrief(advisorBrief, 'advisor'),
  ].filter(Boolean);

  return {
    kpis: {
      openOrders: Number(openOrdersResult?.count ?? 0),
      openOrdersThisWeek: Number(openOrdersThisWeekResult?.count ?? 0),
      revenueMonthUsd: monthUsd,
      revenueMonthAed: monthUsd * USD_TO_AED,
      revenueLastMonthUsd: lastMonthUsd,
      revenueLastMonthAed: lastMonthUsd * USD_TO_AED,
      revenueYearUsd: yearUsd,
      revenueYearAed: yearUsd * USD_TO_AED,
      revenueLastYearUsd: lastYearUsd,
      revenueLastYearAed: lastYearUsd * USD_TO_AED,
      pendingDispatch: Number(pendingDispatchResult?.count ?? 0),
      stagedBatches: Number(stagedResult?.count ?? 0),
      agentAlerts: highPriorityAlerts,
      overdueInvoices: Number(overdueResult?.count ?? 0),
      overdueAmountUsd: overdueUsd,
      overdueAmountAed: overdueUsd * USD_TO_AED,
    },
    agentBriefs,
    recentOrders: mergedOrders,
  };
});

export default adminGetMorningView;
