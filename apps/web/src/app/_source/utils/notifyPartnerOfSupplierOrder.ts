import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { partners, sourceCustomerPos, sourceSupplierOrders, users } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

interface NotifyPartnerOfSupplierOrderParams {
  supplierOrderId: string;
  partnerId: string;
}

/**
 * Notify a wine partner when they receive a Supplier Order
 *
 * Creates an in-app notification and sends email via Loops.
 *
 * @param params - The supplier order ID and partner ID
 */
const notifyPartnerOfSupplierOrder = async ({
  supplierOrderId,
  partnerId,
}: NotifyPartnerOfSupplierOrderParams) => {
  try {
    // Get supplier order details
    const [supplierOrder] = await db
      .select({
        orderNumber: sourceSupplierOrders.orderNumber,
        totalAmountUsd: sourceSupplierOrders.totalAmountUsd,
        customerPoId: sourceSupplierOrders.customerPoId,
        itemCount: sourceSupplierOrders.itemCount,
      })
      .from(sourceSupplierOrders)
      .where(eq(sourceSupplierOrders.id, supplierOrderId));

    if (!supplierOrder) {
      logger.error('Supplier order not found for notification', { supplierOrderId });
      return;
    }

    // Get customer PO details for context
    const [customerPo] = await db
      .select({
        ccPoNumber: sourceCustomerPos.ccPoNumber,
        customerCompany: sourceCustomerPos.customerCompany,
        customerName: sourceCustomerPos.customerName,
      })
      .from(sourceCustomerPos)
      .where(eq(sourceCustomerPos.id, supplierOrder.customerPoId));

    // Get partner details with linked user
    const [partner] = await db
      .select({
        businessName: partners.businessName,
        businessEmail: partners.businessEmail,
        userId: partners.userId,
      })
      .from(partners)
      .where(eq(partners.id, partnerId));

    if (!partner) {
      logger.error('Partner not found for notification', { partnerId });
      return;
    }

    // If partner has a platform account, get their user details
    let userEmail: string | null = null;
    let userName: string | null = null;

    if (partner.userId) {
      const [user] = await db
        .select({
          email: users.email,
          name: users.name,
        })
        .from(users)
        .where(eq(users.id, partner.userId));

      if (user) {
        userEmail = user.email;
        userName = user.name;
      }
    }

    const orderUrl = `${serverConfig.appUrl}/platform/partner/source/orders/${supplierOrderId}`;

    // Format total for display
    const totalFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(supplierOrder.totalAmountUsd ?? 0);

    // Create in-app notification (only if partner has a platform account)
    if (partner.userId) {
      await createNotification({
        userId: partner.userId,
        partnerId,
        type: 'supplier_order_received',
        title: 'New Supplier Order',
        message: `You have received a new order: ${supplierOrder.orderNumber} (${supplierOrder.itemCount} items, ${totalFormatted})`,
        entityType: 'supplier_order',
        entityId: supplierOrderId,
        actionUrl: orderUrl,
        metadata: {
          orderNumber: supplierOrder.orderNumber,
          customerPoNumber: customerPo?.ccPoNumber,
          customerCompany: customerPo?.customerCompany || customerPo?.customerName,
          totalAmountUsd: supplierOrder.totalAmountUsd,
          itemCount: supplierOrder.itemCount,
        },
      });
    }

    // Determine email recipient
    const recipientEmail = userEmail || partner.businessEmail;
    const recipientName = userName || partner.businessName;

    if (!recipientEmail) {
      logger.error('No email recipient found for partner notification', { partnerId });
      return;
    }

    // Send email notification via Loops
    try {
      await loops.sendTransactionalEmail({
        transactionalId: 'source-supplier-order-received',
        email: recipientEmail,
        dataVariables: {
          partnerName: recipientName,
          orderNumber: supplierOrder.orderNumber,
          customerPoNumber: customerPo?.ccPoNumber ?? 'N/A',
          customerName: customerPo?.customerCompany || customerPo?.customerName || 'N/A',
          itemCount: String(supplierOrder.itemCount ?? 0),
          totalAmount: totalFormatted,
          orderUrl,
        },
      });

      logger.dev(`Sent supplier order notification to: ${recipientEmail}`);
    } catch (error) {
      logger.error(`Failed to send supplier order email notification to ${recipientEmail}:`, error);
    }
  } catch (error) {
    logger.error('Failed to notify partner of supplier order:', error);
  }
};

export default notifyPartnerOfSupplierOrder;
