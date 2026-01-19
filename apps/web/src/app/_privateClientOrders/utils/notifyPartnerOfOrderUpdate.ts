import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { partnerMembers, partners, users } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

/**
 * Loops template IDs for partner notifications
 */
const PARTNER_TEMPLATE_IDS = {
  approved: 'cmkguphqs0k6d0iz0gcfl1pey',
  revision_requested: 'cmkgvlamx0l7v0iy9b26wgwx6',
  verification_required: 'cmkgvocem1ozc0izgt1yx9wzj',
  client_verified: 'cmkgwokvl14yf0iufjy071r8e',
  verification_failed: 'cmkgwsns902u30ixe7v2bfcxj',
  delivery_scheduled: 'cmkgwyo9p1czt0ivi8y34fplq',
  delivered: 'cmkgx5q9i163f0ivp4zvwn8lj',
  stock_received: 'cmkj83yen0e1e0iz2kldowsho',
} as const;

type PartnerNotificationType = keyof typeof PARTNER_TEMPLATE_IDS;

interface NotifyPartnerParams {
  orderId: string;
  orderNumber: string;
  partnerId: string;
  type: PartnerNotificationType;
  distributorName?: string;
  paymentReference?: string;
  deliveryDate?: string;
  totalAmount?: number;
  revisionReason?: string;
  verificationNotes?: string;
  clientName?: string;
  itemCount?: number;
}

/**
 * Get notification title based on type
 */
const getNotificationTitle = (type: PartnerNotificationType): string => {
  const titles: Record<PartnerNotificationType, string> = {
    approved: 'Order Approved',
    revision_requested: 'Changes Requested',
    verification_required: 'Client Verification Required',
    client_verified: 'Client Verified',
    verification_failed: 'Verification Failed',
    delivery_scheduled: 'Delivery Scheduled',
    delivered: 'Order Delivered',
    stock_received: 'Stock Received at Distributor',
  };
  return titles[type];
};

/**
 * Get notification message based on type
 */
const getNotificationMessage = (type: PartnerNotificationType, params: NotifyPartnerParams): string => {
  const { orderNumber, distributorName, paymentReference, deliveryDate, itemCount } = params;

  const messages: Record<PartnerNotificationType, string> = {
    approved: `Your order ${orderNumber} has been approved. A distributor will be assigned shortly.`,
    revision_requested: `Changes are needed for order ${orderNumber}. Please review and resubmit.`,
    verification_required: `Please confirm if your client is verified with ${distributorName} for order ${orderNumber}.`,
    client_verified: `Client verified for order ${orderNumber}. Payment reference: ${paymentReference}`,
    verification_failed: `${distributorName} could not verify your client for order ${orderNumber}. Please resolve.`,
    delivery_scheduled: `Delivery for order ${orderNumber} scheduled for ${deliveryDate}.`,
    delivered: `Order ${orderNumber} has been delivered to your client.`,
    stock_received: `${itemCount ?? 'All'} item(s) for order ${orderNumber} arrived at distributor warehouse.`,
  };
  return messages[type];
};

/**
 * Get in-app notification type based on update type
 */
const getInAppNotificationType = (type: PartnerNotificationType) => {
  const typeMap: Record<PartnerNotificationType, 'action_required' | 'status_update' | 'po_approved' | 'revision_requested'> = {
    approved: 'po_approved',
    revision_requested: 'revision_requested',
    verification_required: 'action_required',
    client_verified: 'status_update',
    verification_failed: 'action_required',
    delivery_scheduled: 'status_update',
    delivered: 'status_update',
    stock_received: 'status_update',
  };
  return typeMap[type];
};

/**
 * Notify all partner members of an order update
 *
 * Creates in-app notifications and sends emails via Loops.
 */
const notifyPartnerOfOrderUpdate = async (params: NotifyPartnerParams) => {
  const { orderId, orderNumber, partnerId, type } = params;

  try {
    // Get all partner members
    const members = await db
      .select({
        userId: partnerMembers.userId,
      })
      .from(partnerMembers)
      .where(eq(partnerMembers.partnerId, partnerId));

    if (members.length === 0) {
      logger.warn('No partner members found for notification', { partnerId, orderId });
      return;
    }

    // Get partner details for email
    const [partner] = await db
      .select({
        businessName: partners.businessName,
        businessEmail: partners.businessEmail,
      })
      .from(partners)
      .where(eq(partners.id, partnerId));

    const orderUrl = `${serverConfig.appUrl}/platform/private-orders/${orderId}`;
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
        partnerId,
        type: inAppType,
        title,
        message,
        entityType: 'private_client_order',
        entityId: orderId,
        actionUrl: orderUrl,
        metadata: {
          orderNumber,
          type,
          distributorName: params.distributorName,
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
          const emailPayload = {
            transactionalId: PARTNER_TEMPLATE_IDS[type],
            email: user.email,
            dataVariables: {
              partnerName: user.name ?? partner?.businessName ?? 'Partner',
              orderNumber,
              orderUrl,
              distributorName: params.distributorName ?? '',
              paymentReference: params.paymentReference ?? '',
              deliveryDate: params.deliveryDate ?? '',
              totalAmountUSD: totalFormatted ?? '',
              revisionReason: params.revisionReason ?? '',
              verificationNotes: params.verificationNotes ?? '',
              clientName: params.clientName ?? '',
              itemCount: String(params.itemCount ?? ''),
            },
          };

          // eslint-disable-next-line no-console
          console.log('PCO_EMAIL_PAYLOAD:', JSON.stringify(emailPayload));

          const result = await loops.sendTransactionalEmail(emailPayload);

          // eslint-disable-next-line no-console
          console.log('PCO_EMAIL_RESULT:', JSON.stringify({ email: user.email, type, result }));
        } catch (error) {
          logger.error('PCO: Failed to send partner email via Loops', {
            email: user.email,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Also send to business email if different from member emails
    if (partner?.businessEmail) {
      const memberEmails = await Promise.all(
        members.map(async (m) => {
          const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, m.userId));
          return u?.email;
        }),
      );

      if (!memberEmails.includes(partner.businessEmail)) {
        try {
          logger.info('PCO: Sending partner business email via Loops', {
            templateId: PARTNER_TEMPLATE_IDS[type],
            type,
            email: partner.businessEmail,
          });

          const result = await loops.sendTransactionalEmail({
            transactionalId: PARTNER_TEMPLATE_IDS[type],
            email: partner.businessEmail,
            dataVariables: {
              partnerName: partner.businessName ?? 'Partner',
              orderNumber,
              orderUrl,
              distributorName: params.distributorName ?? '',
              paymentReference: params.paymentReference ?? '',
              deliveryDate: params.deliveryDate ?? '',
              totalAmountUSD: totalFormatted ?? '',
              revisionReason: params.revisionReason ?? '',
              verificationNotes: params.verificationNotes ?? '',
              clientName: params.clientName ?? '',
              itemCount: String(params.itemCount ?? ''),
            },
          });

          logger.info('PCO: Partner business email result', {
            email: partner.businessEmail,
            result: JSON.stringify(result),
            success: result?.success,
          });
        } catch (error) {
          logger.error('PCO: Failed to send partner business email via Loops', {
            email: partner.businessEmail,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  } catch (error) {
    logger.error('Failed to notify partner of order update:', error);
  }
};

export default notifyPartnerOfOrderUpdate;
