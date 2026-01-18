import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { partnerMembers, partners, users } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

/**
 * Loops template IDs for distributor notifications
 */
const DISTRIBUTOR_TEMPLATE_IDS = {
  order_assigned: 'cmkj88ybu0hm20izqhu21bqd5',
  verification_required: 'cmkj8iab307bf0i20to5ndu0j',
  invoice_acknowledged: 'cmkj8msvp08bw0i2f8dqys427',
} as const;

type DistributorNotificationType = keyof typeof DISTRIBUTOR_TEMPLATE_IDS;

interface NotifyDistributorParams {
  orderId: string;
  orderNumber: string;
  distributorId: string;
  type: DistributorNotificationType;
  partnerName?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  paymentReference?: string;
  totalAmount?: number;
}

/**
 * Get notification title based on type
 */
const getNotificationTitle = (type: DistributorNotificationType): string => {
  const titles: Record<DistributorNotificationType, string> = {
    order_assigned: 'New Order Assigned',
    verification_required: 'Client Verification Required',
    invoice_acknowledged: 'Invoice Acknowledged',
  };
  return titles[type];
};

/**
 * Get notification message based on type
 */
const getNotificationMessage = (type: DistributorNotificationType, params: NotifyDistributorParams): string => {
  const { orderNumber, clientName, paymentReference } = params;

  const messages: Record<DistributorNotificationType, string> = {
    order_assigned: `Order ${orderNumber} has been assigned to you. Payment reference: ${paymentReference}`,
    verification_required: `Please verify client ${clientName ?? 'unknown'} in your system for order ${orderNumber}.`,
    invoice_acknowledged: `Partner has acknowledged invoice for order ${orderNumber}. You can confirm payment when received.`,
  };
  return messages[type];
};

/**
 * Get in-app notification type based on update type
 */
const getInAppNotificationType = (type: DistributorNotificationType) => {
  const typeMap: Record<DistributorNotificationType, 'po_assigned' | 'action_required' | 'status_update'> = {
    order_assigned: 'po_assigned',
    verification_required: 'action_required',
    invoice_acknowledged: 'status_update',
  };
  return typeMap[type];
};

/**
 * Notify all distributor members of an order update
 *
 * Creates in-app notifications and sends emails via Loops.
 */
const notifyDistributorOfOrderUpdate = async (params: NotifyDistributorParams) => {
  const { orderId, orderNumber, distributorId, type } = params;

  try {
    // Get all distributor members
    const members = await db
      .select({
        userId: partnerMembers.userId,
      })
      .from(partnerMembers)
      .where(eq(partnerMembers.partnerId, distributorId));

    if (members.length === 0) {
      logger.warn('No distributor members found for notification', { distributorId, orderId });
      return;
    }

    // Get distributor details for email
    const [distributor] = await db
      .select({
        businessName: partners.businessName,
        businessEmail: partners.businessEmail,
      })
      .from(partners)
      .where(eq(partners.id, distributorId));

    const orderUrl = `${serverConfig.appUrl}/platform/distributor/orders/${orderId}`;
    const title = getNotificationTitle(type);
    const message = getNotificationMessage(type, params);
    const inAppType = getInAppNotificationType(type);

    // Format total for display
    const totalFormatted = params.totalAmount
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(params.totalAmount)
      : undefined;

    // Send notifications to each member
    for (const member of members) {
      // Create in-app notification
      await createNotification({
        userId: member.userId,
        type: inAppType,
        title,
        message,
        entityType: 'private_client_order',
        entityId: orderId,
        actionUrl: orderUrl,
        metadata: {
          orderNumber,
          type,
          clientName: params.clientName,
          paymentReference: params.paymentReference,
        },
      });

      // Get user email for Loops
      const [user] = await db
        .select({
          email: users.email,
          name: users.name,
        })
        .from(users)
        .where(eq(users.id, member.userId));

      if (user?.email) {
        try {
          await loops.sendTransactionalEmail({
            transactionalId: DISTRIBUTOR_TEMPLATE_IDS[type],
            email: user.email,
            dataVariables: {
              distributorName: user.name ?? distributor?.businessName ?? 'Distributor',
              orderNumber,
              orderUrl,
              partnerName: params.partnerName ?? '',
              clientName: params.clientName ?? '',
              clientEmail: params.clientEmail ?? '',
              clientPhone: params.clientPhone ?? '',
              paymentReference: params.paymentReference ?? '',
              totalAmount: totalFormatted ?? '',
            },
          });
          logger.dev(`Sent PCO distributor email (${type}) to: ${user.email}`);
        } catch (error) {
          logger.error(`Failed to send PCO distributor email to ${user.email}:`, error);
        }
      }
    }

    // Also send to business email if different from member emails
    if (distributor?.businessEmail) {
      const memberEmails = await Promise.all(
        members.map(async (m) => {
          const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, m.userId));
          return u?.email;
        }),
      );

      if (!memberEmails.includes(distributor.businessEmail)) {
        try {
          await loops.sendTransactionalEmail({
            transactionalId: DISTRIBUTOR_TEMPLATE_IDS[type],
            email: distributor.businessEmail,
            dataVariables: {
              distributorName: distributor.businessName ?? 'Distributor',
              orderNumber,
              orderUrl,
              partnerName: params.partnerName ?? '',
              clientName: params.clientName ?? '',
              clientEmail: params.clientEmail ?? '',
              clientPhone: params.clientPhone ?? '',
              paymentReference: params.paymentReference ?? '',
              totalAmount: totalFormatted ?? '',
            },
          });
          logger.dev(`Sent PCO distributor email (${type}) to business: ${distributor.businessEmail}`);
        } catch (error) {
          logger.error(`Failed to send PCO distributor email to ${distributor.businessEmail}:`, error);
        }
      }
    }
  } catch (error) {
    logger.error('Failed to notify distributor of order update:', error);
  }
};

export default notifyDistributorOfOrderUpdate;
