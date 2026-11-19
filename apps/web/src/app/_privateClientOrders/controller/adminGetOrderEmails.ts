import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';

import getShipmentEmailMode from '@/app/_logistics/data/getShipmentEmailMode';
import getWarehouseUpdateMode from '@/app/_warehouseUpdates/data/getWarehouseUpdateMode';
import getTransferSummaryMode from '@/app/_wms/data/getTransferSummaryMode';
import db from '@/database/client';
import { logisticsShipmentActivityLogs, logisticsShipments, orderEmailOutbox, partners } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';


import getOrderEmailMode, { ORDER_EMAIL_SHADOW_INBOX } from '../data/getOrderEmailMode';

/**
 * The order email switch and the outbox: what is waiting, and what went where
 *
 * The latest 200 emails with the person and order each was for, so in shadow
 * mode every email a partner or distributor would have received can be read
 * and checked against what actually happened on the order.
 */
const adminGetOrderEmails = staffAdminProcedure.query(async () => {
  const [partner, distributor, shipments, transfers, warehouse] = await Promise.all([
    getOrderEmailMode('partner'),
    getOrderEmailMode('distributor'),
    getShipmentEmailMode(),
    getTransferSummaryMode(),
    getWarehouseUpdateMode(),
  ]);

  const rows = await db
    .select({
      id: orderEmailOutbox.id,
      orderId: orderEmailOutbox.orderId,
      audience: orderEmailOutbox.audience,
      event: orderEmailOutbox.event,
      recipientName: orderEmailOutbox.recipientName,
      recipientEmail: orderEmailOutbox.recipientEmail,
      subject: sql<string | null>`${orderEmailOutbox.data}->>'subject'`,
      isAction: orderEmailOutbox.isAction,
      sendAt: orderEmailOutbox.sendAt,
      status: orderEmailOutbox.status,
      sentTo: orderEmailOutbox.sentTo,
      sentAt: orderEmailOutbox.sentAt,
      error: orderEmailOutbox.error,
    })
    .from(orderEmailOutbox)
    .orderBy(desc(orderEmailOutbox.createdAt))
    .limit(200);

  const shipmentRows = await db
    .select({
      id: logisticsShipmentActivityLogs.id,
      shipmentId: logisticsShipmentActivityLogs.shipmentId,
      shipmentNumber: logisticsShipments.shipmentNumber,
      partnerName: partners.businessName,
      milestone: sql<string | null>`${logisticsShipmentActivityLogs.metadata}->>'milestone'`,
      mode: sql<string | null>`${logisticsShipmentActivityLogs.metadata}->>'mode'`,
      sentTo: sql<string | null>`${logisticsShipmentActivityLogs.metadata}->>'to'`,
      sentAt: logisticsShipmentActivityLogs.createdAt,
    })
    .from(logisticsShipmentActivityLogs)
    .innerJoin(logisticsShipments, eq(logisticsShipments.id, logisticsShipmentActivityLogs.shipmentId))
    // Only the shipment's own partner is ever told
    .leftJoin(partners, eq(partners.id, logisticsShipments.partnerId))
    .where(eq(logisticsShipmentActivityLogs.action, 'partner_notified'))
    .orderBy(desc(logisticsShipmentActivityLogs.createdAt))
    .limit(200);

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [sent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orderEmailOutbox)
    .where(and(inArray(orderEmailOutbox.status, ['sent', 'shadowed']), gte(orderEmailOutbox.sentAt, since)));

  return { modes: { partner, distributor, shipments, transfers, warehouse }, shadowInbox: ORDER_EMAIL_SHADOW_INBOX, sentLast30Days: Number(sent?.count ?? 0), rows, shipmentRows };
});

export default adminGetOrderEmails;
