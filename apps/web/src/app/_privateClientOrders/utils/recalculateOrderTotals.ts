import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  partners,
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';

/**
 * Recalculate order totals based on line items and partner settings
 *
 * Fetches partner-specific rates for duty, VAT, and logistics.
 * Falls back to defaults if partner settings are not configured.
 */
const recalculateOrderTotals = async (orderId: string) => {
  // Get the order to find the partner
  const [order] = await db
    .select({
      partnerId: privateClientOrders.partnerId,
    })
    .from(privateClientOrders)
    .where(eq(privateClientOrders.id, orderId));

  // Get partner pricing settings (with defaults)
  let dutyRate = 0.05;
  let vatRate = 0.05;
  let logisticsPerCase = 60;

  if (order?.partnerId) {
    const [partner] = await db
      .select({
        pcoDutyRate: partners.pcoDutyRate,
        pcoVatRate: partners.pcoVatRate,
        logisticsCostPerCase: partners.logisticsCostPerCase,
      })
      .from(partners)
      .where(eq(partners.id, order.partnerId));

    if (partner) {
      dutyRate = partner.pcoDutyRate ?? 0.05;
      vatRate = partner.pcoVatRate ?? 0.05;
      logisticsPerCase = partner.logisticsCostPerCase ?? 60;
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
