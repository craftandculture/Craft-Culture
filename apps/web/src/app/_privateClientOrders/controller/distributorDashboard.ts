import { and, desc, eq, gte, inArray, isNull, notInArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import type { PrivateClientOrder } from '@/database/schema';
import {
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';
import USD_TO_AED from '@/lib/currency/usdToAed';
import { distributorProcedure } from '@/lib/trpc/procedures';

import {
  DISTRIBUTOR_QUEUES,
  DISTRIBUTOR_SKU_LOCKED_STATUSES,
  DISTRIBUTOR_STAGES,
  DISTRIBUTOR_VISIBLE_STATUSES,
} from '../constants';
import distributorOrderView from '../utils/distributorOrderView';
import distributorPartnerView from '../utils/distributorPartnerView';

/**
 * The distributor's dashboard: what is waiting on them, where their orders
 * are, and how much they add up to
 *
 * Every count is built from the same status groups the order list filters
 * by (DISTRIBUTOR_STAGES, DISTRIBUTOR_QUEUES), so a number on the dashboard
 * opens a list of exactly that many orders.
 *
 * Quantities are in bottles. The stored case count adds single bottles to
 * cases as if they were one unit, which read "1 cases" for a bottle.
 */
const distributorDashboard = distributorProcedure.query(
  async ({ ctx: { partnerId, partner } }) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const mine = and(
      eq(privateClientOrders.distributorId, partnerId),
      inArray(privateClientOrders.status, [...DISTRIBUTOR_VISIBLE_STATUSES]),
    );

    const bottlesSql = sql<number>`coalesce(sum(${privateClientOrderItems.quantity} * coalesce(${privateClientOrderItems.caseConfig}, 1)), 0)`;

    const [statusCounts, [totals], [monthlyTotals], [monthlyBottles], recentOrders, [skuMissing]] =
      await Promise.all([
        db
          .select({
            status: privateClientOrders.status,
            count: sql<number>`count(*)`,
            valueUsd: sql<number>`coalesce(sum(${privateClientOrders.totalUsd}), 0)`,
            valueAed: sql<number>`coalesce(sum(${privateClientOrders.totalUsd}), 0) * ${USD_TO_AED}`,
            oldestUpdatedAt: sql<string | null>`min(${privateClientOrders.updatedAt})`,
            idle: sql<number>`count(*) filter (where ${privateClientOrders.updatedAt} < now() - interval '7 days')`,
            lastWeek: sql<number>`count(*) filter (where ${privateClientOrders.updatedAt} >= now() - interval '7 days')`,
          })
          .from(privateClientOrders)
          .where(mine)
          .groupBy(privateClientOrders.status),

        db
          .select({
            totalOrders: sql<number>`count(*)`,
            totalValueUsd: sql<number>`coalesce(sum(${privateClientOrders.totalUsd}), 0)`,
            totalValueAed: sql<number>`coalesce(sum(${privateClientOrders.totalUsd}), 0) * ${USD_TO_AED}`,
          })
          .from(privateClientOrders)
          .where(mine),

        db
          .select({
            totalOrders: sql<number>`count(*)`,
            totalValueUsd: sql<number>`coalesce(sum(${privateClientOrders.totalUsd}), 0)`,
            totalValueAed: sql<number>`coalesce(sum(${privateClientOrders.totalUsd}), 0) * ${USD_TO_AED}`,
          })
          .from(privateClientOrders)
          .where(and(mine, gte(privateClientOrders.distributorAssignedAt, thirtyDaysAgo))),

        db
          .select({ bottles: bottlesSql })
          .from(privateClientOrders)
          .innerJoin(
            privateClientOrderItems,
            eq(privateClientOrderItems.orderId, privateClientOrders.id),
          )
          .where(and(mine, gte(privateClientOrders.distributorAssignedAt, thirtyDaysAgo))),

        db
          .select({ order: privateClientOrders })
          .from(privateClientOrders)
          .where(mine)
          .orderBy(desc(privateClientOrders.distributorAssignedAt))
          .limit(6),

        // Only asked of distributors who record a bundle SKU on each order
        partner.requiresOrderSku
          ? db
              .select({ count: sql<number>`count(*)` })
              .from(privateClientOrders)
              .where(
                and(
                  mine,
                  isNull(privateClientOrders.distributorSku),
                  notInArray(
                    privateClientOrders.status,
                    DISTRIBUTOR_SKU_LOCKED_STATUSES as PrivateClientOrder['status'][],
                  ),
                ),
              )
          : Promise.resolve([{ count: 0 }]),
      ]);

    // Orders and value per stage, from the same groups the list filters by
    const stageTotals = (statuses: readonly string[]) => {
      const rows = statusCounts.filter((c) => statuses.includes(c.status));
      const oldest = rows
        .map((c) => (c.oldestUpdatedAt ? new Date(c.oldestUpdatedAt).getTime() : null))
        .filter((t): t is number => t !== null)
        .sort((a, b) => a - b)[0];
      return {
        count: rows.reduce((sum, c) => sum + Number(c.count), 0),
        valueUsd: rows.reduce((sum, c) => sum + Number(c.valueUsd), 0),
        valueAed: rows.reduce((sum, c) => sum + Number(c.valueAed), 0),
        /** Days the longest-waiting order has gone without a change */
        oldestDays: oldest ? Math.floor((Date.now() - oldest) / 86_400_000) : null,
        /** Orders with no change in 7 days */
        idle: rows.reduce((sum, c) => sum + Number(c.idle), 0),
        /** Orders that changed in the last 7 days (for Delivered: delivered this week) */
        lastWeek: rows.reduce((sum, c) => sum + Number(c.lastWeek), 0),
      };
    };

    const countOf = (statuses: readonly string[]) =>
      statusCounts
        .filter((c) => statuses.includes(c.status))
        .reduce((sum, c) => sum + Number(c.count), 0);

    const delivered = countOf(DISTRIBUTOR_STAGES.delivered);

    // Whose client each order is
    const partnerViews = await distributorPartnerView(recentOrders.map((row) => row.order.partnerId));

    return {
      kpis: {
        activeOrders: Number(totals?.totalOrders ?? 0) - delivered,
        totalOrders: Number(totals?.totalOrders ?? 0),
        totalValueUsd: Number(totals?.totalValueUsd ?? 0),
        totalValueAed: Number(totals?.totalValueAed ?? 0),
        monthlyOrders: Number(monthlyTotals?.totalOrders ?? 0),
        monthlyBottles: Number(monthlyBottles?.bottles ?? 0),
        monthlyValueUsd: Number(monthlyTotals?.totalValueUsd ?? 0),
        monthlyValueAed: Number(monthlyTotals?.totalValueAed ?? 0),
      },
      requiresOrderSku: partner.requiresOrderSku,
      queues: {
        verify: countOf(DISTRIBUTOR_QUEUES.verify.statuses),
        clientPayment: countOf(DISTRIBUTOR_QUEUES.clientPayment.statuses),
        payCc: countOf(DISTRIBUTOR_QUEUES.payCc.statuses),
        receive: countOf(DISTRIBUTOR_QUEUES.receive.statuses),
        deliver: countOf(DISTRIBUTOR_QUEUES.deliver.statuses),
        skuMissing: Number(skuMissing?.count ?? 0),
      },
      stages: {
        verification: stageTotals(DISTRIBUTOR_STAGES.verification),
        payment: stageTotals(DISTRIBUTOR_STAGES.payment),
        inbound: stageTotals(DISTRIBUTOR_STAGES.inbound),
        delivery: stageTotals(DISTRIBUTOR_STAGES.delivery),
        delivered: stageTotals(DISTRIBUTOR_STAGES.delivered),
      },
      recentOrders: recentOrders.map((row) => ({
        ...distributorOrderView(row.order),
        partner: partnerViews.get(row.order.partnerId ?? '') ?? null,
      })),
    };
  },
);

export default distributorDashboard;
