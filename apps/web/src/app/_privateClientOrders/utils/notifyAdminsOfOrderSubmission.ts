import { eq } from 'drizzle-orm';

import createAdminNotifications from '@/app/_notifications/utils/createAdminNotifications';
import db from '@/database/client';
import { partners } from '@/database/schema';
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
    const adminUsers = await db.query.users.findMany({
      where: {
        role: 'admin',
      },
      columns: {
        id: true,
        email: true,
        name: true,
      },
    });

    // Send email to each admin
    for (const admin of adminUsers) {
      if (admin.email) {
        try {
          await loops.sendTransactionalEmail({
            transactionalId: ADMIN_TEMPLATE_ID,
            email: admin.email,
            dataVariables: {
              adminName: admin.name ?? 'Admin',
              orderNumber,
              orderUrl,
              partnerName,
              clientName: clientName ?? 'Not specified',
              totalAmount: totalFormatted,
              itemCount: String(itemCount ?? 0),
            },
          });
          logger.dev(`Sent PCO admin submission email to: ${admin.email}`);
        } catch (error) {
          logger.error(`Failed to send PCO admin email to ${admin.email}:`, error);
        }
      }
    }
  } catch (error) {
    logger.error('Failed to notify admins of order submission:', error);
  }
};

export default notifyAdminsOfOrderSubmission;
