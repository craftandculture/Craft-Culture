import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  partners,
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';

/**
 * Recalculate order totals based on line items and distributor settings
 *
 * Fetches distributor-specific rates for duty, VAT, and logistics.
 * Falls back to defaults if distributor is not assigned or settings are not configured.
 */
const recalculateOrderTotals = async (orderId: string) => {
  // Get the order to find the assigned distributor
  const [order] = await db
    .select({
      distributorId: privateClientOrders.distributorId,
    })
    .from(privateClientOrders)
    .where(eq(privateClientOrders.id, orderId));

  // Get distributor pricing settings (with defaults)
  let dutyRate = 0.05;
  let vatRate = 0.05;
  let logisticsPerCase = 60;

  if (order?.distributorId) {
    const [distributor] = await db
      .select({
        pcoDutyRate: partners.pcoDutyRate,
        pcoVatRate: partners.pcoVatRate,
        logisticsCostPerCase: partners.logisticsCostPerCase,
      })
      .from(partners)
      .where(eq(partners.id, order.distributorId));

    if (distributor) {
      dutyRate = distributor.pcoDutyRate ?? 0.05;
      vatRate = distributor.pcoVatRate ?? 0.05;
      logisticsPerCase = distributor.logisticsCostPerCase ?? 60;
    }
  }

  // Get sum of all items
  const [totals] = await db
    .select({
      itemCount: sql<number>`count(*)`,
      caseCount: sql<number>`coalesce(sum(${privateClientOrderItems.quantity}), 0)`,
      subtotalUsd: sql<number>`coalesce(sum(${privateClientOrderItems.totalUsd}), 0)`,
    })
    .from(privateClientOrderItems)
    .where(eq(privateClientOrderItems.orderId, orderId));

  const itemCount = Number(totals?.itemCount ?? 0);
  const caseCount = Number(totals?.caseCount ?? 0);
  const subtotalUsd = Number(totals?.subtotalUsd ?? 0);

  // Calculate duty and VAT using partner rates
  const dutyUsd = subtotalUsd * dutyRate;
  const vatUsd = (subtotalUsd + dutyUsd) * vatRate;
  const logisticsUsd = caseCount * logisticsPerCase;

  const totalUsd = subtotalUsd + dutyUsd + vatUsd + logisticsUsd;

  // Update the order
  await db
    .update(privateClientOrders)
    .set({
      itemCount,
      caseCount,
      subtotalUsd,
      dutyUsd,
      vatUsd,
      logisticsUsd,
      totalUsd,
      updatedAt: new Date(),
    })
    .where(eq(privateClientOrders.id, orderId));
};

export default recalculateOrderTotals;
