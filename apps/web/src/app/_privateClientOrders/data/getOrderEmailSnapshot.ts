import { and, asc, eq, isNotNull } from 'drizzle-orm';

import db from '@/database/client';
import {
  partners,
  privateClientOrderActivityLogs,
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';

import type { OrderEmailSnapshot, OrderStatus } from '../utils/orderEmailTypes';

/**
 * The order as an email describes it: its state, wines, parties and history
 *
 * @param orderId - The order
 * @returns The snapshot with the partner's type and the distributor's id, or
 *   null when the order no longer exists
 */
const getOrderEmailSnapshot = async (orderId: string) => {
  const [order] = await db.select().from(privateClientOrders).where(eq(privateClientOrders.id, orderId)).limit(1);
  if (!order) return null;

  const [items, history, [partner], [distributor]] = await Promise.all([
    db
      .select({
        productName: privateClientOrderItems.productName,
        vintage: privateClientOrderItems.vintage,
        region: privateClientOrderItems.region,
        bottleSize: privateClientOrderItems.bottleSize,
        caseConfig: privateClientOrderItems.caseConfig,
        quantity: privateClientOrderItems.quantity,
      })
      .from(privateClientOrderItems)
      .where(eq(privateClientOrderItems.orderId, orderId))
      .orderBy(asc(privateClientOrderItems.createdAt)),
    db
      .select({ status: privateClientOrderActivityLogs.newStatus, at: privateClientOrderActivityLogs.createdAt })
      .from(privateClientOrderActivityLogs)
      .where(and(eq(privateClientOrderActivityLogs.orderId, orderId), isNotNull(privateClientOrderActivityLogs.newStatus)))
      .orderBy(asc(privateClientOrderActivityLogs.createdAt)),
    order.partnerId
      ? db.select({ type: partners.type }).from(partners).where(eq(partners.id, order.partnerId)).limit(1)
      : Promise.resolve([]),
    order.distributorId
      ? db
          .select({ businessName: partners.businessName })
          .from(partners)
          .where(eq(partners.id, order.distributorId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const snapshot: OrderEmailSnapshot = {
    id: order.id,
    orderNumber: order.orderNumber ?? order.id,
    status: order.status as OrderStatus,
    clientName: order.clientName,
    clientEmail: order.clientEmail,
    clientPhone: order.clientPhone,
    distributorName: distributor?.businessName ?? null,
    paymentReference: order.paymentReference,
    totalUsd: order.totalUsd,
    scheduledDeliveryDate: order.scheduledDeliveryDate,
    deliveredAt: order.deliveredAt,
    revisionReason: order.revisionReason,
    cancellationReason: order.cancellationReason,
    distributorVerificationNotes: order.distributorVerificationNotes,
    items,
    history: history.flatMap((row) => (row.status ? [{ status: row.status as OrderStatus, at: row.at }] : [])),
  };

  return {
    snapshot,
    partnerId: order.partnerId,
    partnerType: partner?.type ?? null,
    distributorId: order.distributorId,
  };
};

export default getOrderEmailSnapshot;
