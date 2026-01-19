import { eq } from 'drizzle-orm';

import createAdminNotifications from '@/app/_notifications/utils/createAdminNotifications';
import db from '@/database/client';
import { partners, users } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

/**
 * Loops template ID for admin order submission notification
 */
const ADMIN_TEMPLATE_ID = 'cmkj8qtdn08g90i25gzirspb4';

interface NotifyAdminsParams {
  orderId: string;
  orderNumber: string;
  partnerId: string;
  clientName?: string;
  totalAmount?: number;
  itemCount?: number;
}

/**
 * Notify all admins when a partner submits a new private client order
 *
 * Creates in-app notifications and sends emails via Loops.
 */
const notifyAdminsOfOrderSubmission = async (params: NotifyAdminsParams) => {
  const { orderId, orderNumber, partnerId, clientName, totalAmount, itemCount } = params;

  logger.info('PCO: notifyAdminsOfOrderSubmission called', { orderId, orderNumber, partnerId });

  try {
    // Get partner details
    const [partner] = await db
      .select({
        businessName: partners.businessName,
      })
      .from(partners)
      .where(eq(partners.id, partnerId));

    const partnerName = partner?.businessName ?? 'Unknown Partner';
    const orderUrl = `${serverConfig.appUrl}/platform/admin/private-orders/${orderId}`;

    // Format total for display
    const totalFormatted = totalAmount
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(totalAmount)
      : 'TBD';

    // Create in-app notifications for all admins
    await createAdminNotifications({
      type: 'po_submitted',
      title: 'New Private Order Submitted',
      message: `${partnerName} submitted order ${orderNumber} for ${clientName ?? 'a client'} (${totalFormatted})`,
      entityType: 'private_client_order',
      entityId: orderId,
      actionUrl: orderUrl,
      metadata: {
        orderNumber,
        partnerName,
        clientName,
        totalAmount,
        itemCount,
      },
    });

    // Get all admin users for email
    const adminUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.role, 'admin'));

    logger.info('PCO: Found admin users for notification', {
      count: adminUsers.length,
      emails: adminUsers.map((a) => a.email),
    });

    // Send email to each admin
    logger.info('PCO: About to send emails to admins', { adminCount: adminUsers.length });

    for (const admin of adminUsers) {
      if (admin.email) {
        try {
          const emailPayload = {
            transactionalId: ADMIN_TEMPLATE_ID,
            email: admin.email,
            dataVariables: {
              adminName: admin.name ?? 'Admin',
              orderNumber,
              orderUrl,
              partnerName,
              clientName: clientName ?? 'Not specified',
              totalAmountUSD: totalFormatted,
              itemCount: String(itemCount ?? 0),
            },
          };

          logger.info('PCO: Sending email via Loops', {
            templateId: ADMIN_TEMPLATE_ID,
            email: admin.email,
            payload: JSON.stringify(emailPayload),
          });

          const result = await loops.sendTransactionalEmail(emailPayload);

          logger.info('PCO: Loops email result', {
            email: admin.email,
            result: JSON.stringify(result),
            success: result?.success,
          });
        } catch (error) {
          logger.error('PCO: Failed to send email via Loops', {
            email: admin.email,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      }
    }
  } catch (error) {
    logger.error('PCO: Failed to notify admins of order submission', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export default notifyAdminsOfOrderSubmission;
