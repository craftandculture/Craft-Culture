import { and, eq, gte, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  exchangeOrderItems,
  exchangeOrders,
  partners,
  supplierPayouts,
  supplierProducts,
  supplierShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get Wine Exchange admin dashboard metrics
 *
 * Returns platform-wide KPIs for the exchange marketplace:
 * - Total suppliers and status breakdown
 * - Inventory metrics
 * - Order volume and value
 * - Pending payouts
 * - Active shipments
 *
 * @example
 *   const dashboard = await api.exchange.admin.dashboard.query();
 */
const adminDashboard = adminProcedure.query(async () => {
  // Get supplier stats
  const [supplierStats] = await db
    .select({
      totalSuppliers: sql<number>`count(*)::int`,
      activeSuppliers: sql<number>`count(*) filter (where ${partners.status} = 'active')::int`,
      pendingSuppliers: sql<number>`count(*) filter (where ${partners.status} = 'pending')::int`,
    })
    .from(partners)
    .where(eq(partners.type, 'supplier'));

  // Get inventory stats
  const [inventoryStats] = await db
    .select({
      totalProducts: sql<number>`count(distinct ${supplierProducts.productId})::int`,
      totalCases: sql<number>`coalesce(sum(${supplierProducts.casesAvailable}), 0)::int`,
      totalValue: sql<number>`coalesce(sum(${supplierProducts.casesAvailable} * ${supplierProducts.pricePerCase}::numeric), 0)::numeric`,
    })
    .from(supplierProducts)
    .where(eq(supplierProducts.status, 'available'));

  // Get order stats (this month)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [orderStats] = await db
    .select({
      totalOrders: sql<number>`count(*)::int`,
      totalValue: sql<number>`coalesce(sum(${exchangeOrders.totalAmount}), 0)::numeric`,
      monthOrders: sql<number>`count(*) filter (where ${exchangeOrders.createdAt} >= ${startOfMonth})::int`,
      monthValue: sql<number>`coalesce(sum(${exchangeOrders.totalAmount}) filter (where ${exchangeOrders.createdAt} >= ${startOfMonth}), 0)::numeric`,
      pendingOrders: sql<number>`count(*) filter (where ${exchangeOrders.status} in ('pending', 'confirmed', 'paid'))::int`,
    })
    .from(exchangeOrders);

  // Get payout stats
  const [payoutStats] = await db
    .select({
      pendingPayouts: sql<number>`count(*)::int`,
      pendingAmount: sql<number>`coalesce(sum(${supplierPayouts.amount}), 0)::numeric`,
    })
    .from(supplierPayouts)
    .where(eq(supplierPayouts.status, 'pending'));

  // Get shipment stats
  const [shipmentStats] = await db
    .select({
      inTransit: sql<number>`count(*) filter (where ${supplierShipments.status} = 'in_transit')::int`,
      awaitingCheckIn: sql<number>`count(*) filter (where ${supplierShipments.status} = 'arrived')::int`,
      withIssues: sql<number>`count(*) filter (where ${supplierShipments.status} = 'issues')::int`,
    })
    .from(supplierShipments);

  return {
    suppliers: {
      total: supplierStats?.totalSuppliers ?? 0,
      active: supplierStats?.activeSuppliers ?? 0,
      pending: supplierStats?.pendingSuppliers ?? 0,
    },
    inventory: {
      totalProducts: inventoryStats?.totalProducts ?? 0,
      totalCases: inventoryStats?.totalCases ?? 0,
      totalValue: Number(inventoryStats?.totalValue ?? 0),
    },
    orders: {
      total: orderStats?.totalOrders ?? 0,
      totalValue: Number(orderStats?.totalValue ?? 0),
      monthOrders: orderStats?.monthOrders ?? 0,
      monthValue: Number(orderStats?.monthValue ?? 0),
      pending: orderStats?.pendingOrders ?? 0,
    },
    payouts: {
      pendingCount: payoutStats?.pendingPayouts ?? 0,
      pendingAmount: Number(payoutStats?.pendingAmount ?? 0),
    },
    shipments: {
      inTransit: shipmentStats?.inTransit ?? 0,
      awaitingCheckIn: shipmentStats?.awaitingCheckIn ?? 0,
      withIssues: shipmentStats?.withIssues ?? 0,
    },
  };
});

export default adminDashboard;
