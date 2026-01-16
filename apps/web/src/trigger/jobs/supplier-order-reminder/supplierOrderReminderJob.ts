import { logger, schedules } from '@trigger.dev/sdk';
import { and, eq, inArray, isNull, lt } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import {
  partners,
  sourceCustomerPos,
  sourceSupplierOrders,
  users,
} from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import triggerDb from '@/trigger/triggerDb';

interface SendOrderReminderParams {
  supplierOrderId: string;
  orderNumber: string;
  itemCount: number;
  totalAmountUsd: number;
  sentAt: Date;
  partnerId: string;
  userId: string | null;
  businessName: string;
  businessEmail: string | null;
  customerPoNumber: string | null;
  customerName: string | null;
}

/**
 * Send a confirmation reminder to a partner for an unconfirmed supplier order
 */
const sendOrderReminder = async ({
  supplierOrderId,
  orderNumber,
  itemCount,
  totalAmountUsd,
  sentAt,
  partnerId,
  userId,
  businessName,
  businessEmail,
  customerPoNumber,
  customerName,
}: SendOrderReminderParams) => {
  // Get user email if partner has a platform account
  let userEmail: string | null = null;
  let userName: string | null = null;

  if (userId) {
    const [user] = await triggerDb
      .select({
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (user) {
      userEmail = user.email;
      userName = user.name;
    }
  }

  const notificationEmail = userEmail || businessEmail;
  const recipientName = userName || businessName;

  if (!notificationEmail) {
    logger.warn('No email found for partner reminder', { partnerId });
    return;
  }

  const orderUrl = `${serverConfig.appUrl}/platform/partner/source/orders/${supplierOrderId}`;

  // Calculate hours since sent
  const hoursSinceSent = Math.round(
    (Date.now() - sentAt.getTime()) / (1000 * 60 * 60)
  );

  // Format total for display
  const totalFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalAmountUsd ?? 0);

  // Create in-app notification (only if partner has a platform account)
  if (userId) {
    await createNotification({
      userId,
      type: 'supplier_order_reminder',
      title: 'Order Confirmation Needed',
      message: `Reminder: Please confirm order ${orderNumber} (${itemCount} items, ${totalFormatted})`,
      entityType: 'supplier_order',
      entityId: supplierOrderId,
      actionUrl: orderUrl,
      metadata: {
        orderNumber,
        customerPoNumber,
        customerName,
        totalAmountUsd,
        itemCount,
        hoursSinceSent,
      },
    });
  }

  // Send email notification via Loops
  try {
    await loops.sendTransactionalEmail({
      transactionalId: 'source-supplier-order-reminder',
      email: notificationEmail,
      dataVariables: {
        partnerName: recipientName,
        orderNumber,
        customerPoNumber: customerPoNumber ?? 'N/A',
        customerName: customerName ?? 'N/A',
        itemCount: String(itemCount ?? 0),
        totalAmount: totalFormatted,
        hoursSinceSent: String(hoursSinceSent),
        orderUrl,
      },
    });

    logger.info(`Sent order reminder to ${notificationEmail} for order ${orderNumber}`);
  } catch (error) {
    logger.error('Failed to send order reminder email', {
      email: notificationEmail,
      supplierOrderId,
      error,
    });
  }
};

/**
 * Supplier Order Confirmation Reminder Job
 *
 * Runs every 6 hours to send reminder notifications to partners who haven't
 * confirmed supplier orders within 24 hours.
 *
 * Sends reminders when:
 * - Supplier order was sent more than 24 hours ago
 * - Status is still 'sent' or 'pending_confirmation' (not yet confirmed)
 * - Order hasn't been confirmed, rejected, or cancelled
 */
export const supplierOrderReminderJob = schedules.task({
  id: 'supplier-order-reminder',
  cron: {
    pattern: '0 */6 * * *', // Every 6 hours
    timezone: 'Asia/Dubai',
  },
  async run() {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find supplier orders sent more than 24 hours ago that are still pending
    const pendingOrders = await triggerDb
      .select({
        id: sourceSupplierOrders.id,
        orderNumber: sourceSupplierOrders.orderNumber,
        itemCount: sourceSupplierOrders.itemCount,
        totalAmountUsd: sourceSupplierOrders.totalAmountUsd,
        sentAt: sourceSupplierOrders.sentAt,
        partnerId: sourceSupplierOrders.partnerId,
        customerPoId: sourceSupplierOrders.customerPoId,
      })
      .from(sourceSupplierOrders)
      .where(
        and(
          inArray(sourceSupplierOrders.status, ['sent', 'pending_confirmation']),
          lt(sourceSupplierOrders.sentAt, twentyFourHoursAgo),
          isNull(sourceSupplierOrders.confirmedAt)
        )
      );

    if (pendingOrders.length === 0) {
      logger.info('No pending supplier orders found for reminders');
      return;
    }

    logger.info(
      `Found ${pendingOrders.length} supplier orders pending confirmation for 24+ hours`
    );

    let remindersCount = 0;

    for (const order of pendingOrders) {
      // Get partner details
      const [partner] = await triggerDb
        .select({
          businessName: partners.businessName,
          businessEmail: partners.businessEmail,
          userId: partners.userId,
        })
        .from(partners)
        .where(eq(partners.id, order.partnerId));

      if (!partner) {
        logger.warn('Partner not found for order reminder', {
          orderId: order.id,
          partnerId: order.partnerId,
        });
        continue;
      }

      // Get customer PO details for context
      const [customerPo] = await triggerDb
        .select({
          ccPoNumber: sourceCustomerPos.ccPoNumber,
          customerCompany: sourceCustomerPos.customerCompany,
          customerName: sourceCustomerPos.customerName,
        })
        .from(sourceCustomerPos)
        .where(eq(sourceCustomerPos.id, order.customerPoId));

      try {
        await sendOrderReminder({
          supplierOrderId: order.id,
          orderNumber: order.orderNumber,
          itemCount: order.itemCount ?? 0,
          totalAmountUsd: order.totalAmountUsd ?? 0,
          sentAt: order.sentAt!,
          partnerId: order.partnerId,
          userId: partner.userId,
          businessName: partner.businessName,
          businessEmail: partner.businessEmail,
          customerPoNumber: customerPo?.ccPoNumber ?? null,
          customerName: customerPo?.customerCompany || customerPo?.customerName || null,
        });
        remindersCount++;
      } catch (error) {
        logger.error('Failed to send order reminder', {
          orderId: order.id,
          partnerId: order.partnerId,
          error,
        });
      }
    }

    logger.info(`Sent ${remindersCount} supplier order reminders`);
  },
});
