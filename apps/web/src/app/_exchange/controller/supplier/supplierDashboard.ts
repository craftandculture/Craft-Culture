import { and, eq, gte, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  exchangeOrderItems,
  supplierPayouts,
  supplierProducts,
  supplierShipments,
} from '@/database/schema';
import { supplierProcedure } from '@/lib/trpc/procedures';

/**
 * Get supplier dashboard KPIs
 *
 * Returns key metrics for the supplier portal dashboard:
 * - Total products listed
 * - Available cases in warehouse
 * - Total sales (all time)
 * - Sales this month
 * - Pending payout amount
 * - Active shipments in transit
 *
 * @example
 *   const dashboard = await api.exchange.supplier.dashboard.query();
 */
const supplierDashboard = supplierProcedure.query(async ({ ctx }) => {
  const { partnerId } = ctx;

  // Get product and inventory stats
  const [inventoryStats] = await db
    .select({
      totalProducts: sql<number>`count(distinct ${supplierProducts.productId})::int`,
      totalCases: sql<number>`coalesce(sum(${supplierProducts.casesAvailable}), 0)::int`,
      availableProducts: sql<number>`count(*) filter (where ${supplierProducts.status} = 'available')::int`,
    })
    .from(supplierProducts)
    .where(eq(supplierProducts.supplierId, partnerId));

  // Get sales stats
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [salesStats] = await db
    .select({
      totalSales: sql<number>`coalesce(sum(${exchangeOrderItems.totalPrice}), 0)::numeric`,
      totalOrders: sql<number>`count(distinct ${exchangeOrderItems.orderId})::int`,
      monthSales: sql<number>`coalesce(sum(${exchangeOrderItems.totalPrice}) filter (where ${exchangeOrderItems.createdAt} >= ${startOfMonth}), 0)::numeric`,
      monthOrders: sql<number>`count(distinct ${exchangeOrderItems.orderId}) filter (where ${exchangeOrderItems.createdAt} >= ${startOfMonth})::int`,
    })
    .from(exchangeOrderItems)
    .where(eq(exchangeOrderItems.supplierId, partnerId));

  // Get pending payout amount
  const [payoutStats] = await db
    .select({
      pendingAmount: sql<number>`coalesce(sum(${supplierPayouts.amount}), 0)::numeric`,
      pendingCount: sql<number>`count(*)::int`,
    })
    .from(supplierPayouts)
    .where(
      and(
        eq(supplierPayouts.supplierId, partnerId),
        eq(supplierPayouts.status, 'pending'),
      ),
    );

  // Get active shipments
  const [shipmentStats] = await db
    .select({
      activeShipments: sql<number>`count(*)::int`,
    })
    .from(supplierShipments)
    .where(
      and(
        eq(supplierShipments.supplierId, partnerId),
        sql`${supplierShipments.status} in ('submitted', 'in_transit')`,
      ),
    );

  return {
    inventory: {
      totalProducts: inventoryStats?.totalProducts ?? 0,
      totalCases: inventoryStats?.totalCases ?? 0,
      availableProducts: inventoryStats?.availableProducts ?? 0,
    },
    sales: {
      totalSales: Number(salesStats?.totalSales ?? 0),
      totalOrders: salesStats?.totalOrders ?? 0,
      monthSales: Number(salesStats?.monthSales ?? 0),
      monthOrders: salesStats?.monthOrders ?? 0,
    },
    payouts: {
      pendingAmount: Number(payoutStats?.pendingAmount ?? 0),
      pendingCount: payoutStats?.pendingCount ?? 0,
    },
    shipments: {
      activeShipments: shipmentStats?.activeShipments ?? 0,
    },
  };
});

export default supplierDashboard;
