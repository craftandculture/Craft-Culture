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
 * Runs queries in parallel for performance.
 */
const adminGetMorningView = adminProcedure.query(async () => {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [
    openOrdersResult,
    openOrdersThisWeekResult,
    revenueWeekResult,
    revenueLastWeekResult,
    pendingDispatchResult,
    stagedResult,
    overdueResult,
    scoutBrief,
    conciergeBrief,
    storytellerBrief,
    recentPco,
    recentZoho,
  ] = await Promise.all([
    // 1. Open orders count
    db
      .select({ count: sql<number>`count(*)` })
      .from(privateClientOrders)
      .where(inArray(privateClientOrders.status, activeStatuses))
      .then((r) => r[0]),

    // 2. Open orders created this week
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

    // 3. Revenue this week (AED)
    db
      .select({
        total: sql<number>`coalesce(sum(${privateClientOrders.totalAed}), 0)`,
      })
      .from(privateClientOrders)
      .where(
        and(
          not(
            inArray(privateClientOrders.status, [
              'draft',
              'cancelled',
            ]),
          ),
          gte(privateClientOrders.createdAt, sevenDaysAgo),
        ),
      )
      .then((r) => r[0]),

    // 4. Revenue last week (AED) — for delta %
    db
      .select({
        total: sql<number>`coalesce(sum(${privateClientOrders.totalAed}), 0)`,
      })
      .from(privateClientOrders)
      .where(
        and(
          not(
            inArray(privateClientOrders.status, [
              'draft',
              'cancelled',
            ]),
          ),
          gte(privateClientOrders.createdAt, fourteenDaysAgo),
          lt(privateClientOrders.createdAt, sevenDaysAgo),
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

    // 7. Overdue logistics invoices
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
        total: zohoSalesOrders.total,
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

  // Merge + sort recent orders
  const mergedOrders = [
    ...recentPco.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber ?? '',
      source: 'pco' as const,
      customerName: o.customerName ?? '',
      totalAed: o.totalAed,
      status: o.status ?? '',
      createdAt: o.createdAt,
    })),
    ...recentZoho.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber ?? '',
      source: 'zoho' as const,
      customerName: o.customerName ?? '',
      totalAed: o.total,
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
      revenueWeekAed: Number(revenueWeekResult?.total ?? 0),
      revenueLastWeekAed: Number(revenueLastWeekResult?.total ?? 0),
      pendingDispatch: Number(pendingDispatchResult?.count ?? 0),
      stagedBatches: Number(stagedResult?.count ?? 0),
      agentAlerts: highPriorityAlerts,
      overdueInvoices: Number(overdueResult?.count ?? 0),
      overdueAmountUsd: Number(overdueResult?.totalAmount ?? 0),
    },
    agentBriefs,
    recentOrders: mergedOrders,
  };
});

export default adminGetMorningView;
