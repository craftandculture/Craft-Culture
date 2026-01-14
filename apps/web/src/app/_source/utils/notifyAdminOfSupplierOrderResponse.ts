import { eq } from 'drizzle-orm';

import createAdminNotifications from '@/app/_notifications/utils/createAdminNotifications';
import db from '@/database/client';
import { partners, sourceCustomerPos, sourceSupplierOrders, users } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

interface NotifyAdminOfSupplierOrderResponseParams {
  supplierOrderId: string;
  partnerId: string;
  status: 'confirmed' | 'partial' | 'rejected';
  confirmedCount: number;
  updatedCount: number;
  rejectedCount: number;
}

/**
 * Notify admins when a wine partner confirms, updates, or rejects items in a supplier order
 *
 * Creates in-app notifications for all admins and sends email notifications.
 *
 * @param params - The order details and response status
 */
const notifyAdminOfSupplierOrderResponse = async ({
  supplierOrderId,
  partnerId,
  status,
  confirmedCount,
  updatedCount,
  rejectedCount,
}: NotifyAdminOfSupplierOrderResponseParams) => {
  try {
    // Get supplier order details
    const [supplierOrder] = await db
      .select({
        orderNumber: sourceSupplierOrders.orderNumber,
        customerPoId: sourceSupplierOrders.customerPoId,
        confirmedAmountUsd: sourceSupplierOrders.confirmedAmountUsd,
        itemCount: sourceSupplierOrders.itemCount,
      })
      .from(sourceSupplierOrders)
      .where(eq(sourceSupplierOrders.id, supplierOrderId));

    if (!supplierOrder) {
      logger.error('Supplier order not found for admin notification', { supplierOrderId });
      return;
    }

    // Get customer PO details
    const [customerPo] = await db
      .select({
        ccPoNumber: sourceCustomerPos.ccPoNumber,
        customerCompany: sourceCustomerPos.customerCompany,
      })
      .from(sourceCustomerPos)
      .where(eq(sourceCustomerPos.id, supplierOrder.customerPoId));

    // Get partner details
    const [partner] = await db
      .select({
        businessName: partners.businessName,
      })
      .from(partners)
      .where(eq(partners.id, partnerId));

    if (!partner) {
      logger.error('Partner not found for admin notification', { partnerId });
      return;
    }

    const customerPoUrl = `${serverConfig.appUrl}/platform/admin/source/customer-pos/${supplierOrder.customerPoId}`;

    // Determine notification message based on status
    let statusMessage: string;
    let notificationType: string;

    if (status === 'confirmed') {
      statusMessage = `confirmed all ${confirmedCount} items`;
      notificationType = 'supplier_order_confirmed';
    } else if (status === 'rejected') {
      statusMessage = `rejected all ${rejectedCount} items`;
      notificationType = 'supplier_order_rejected';
    } else {
      const parts = [];
      if (confirmedCount > 0) parts.push(`${confirmedCount} confirmed`);
      if (updatedCount > 0) parts.push(`${updatedCount} updated`);
      if (rejectedCount > 0) parts.push(`${rejectedCount} rejected`);
      statusMessage = parts.join(', ');
      notificationType = 'supplier_order_partial';
    }

    const totalFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(supplierOrder.confirmedAmountUsd ?? 0);

    // Create in-app notifications for all admins
    try {
      await createAdminNotifications({
        type: notificationType,
        title: `Supplier Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: `${partner.businessName} ${statusMessage} for ${supplierOrder.orderNumber} (${totalFormatted})`,
        entityType: 'supplier_order',
        entityId: supplierOrderId,
        actionUrl: customerPoUrl,
        metadata: {
          orderNumber: supplierOrder.orderNumber,
          customerPoNumber: customerPo?.ccPoNumber,
          partnerId,
          partnerName: partner.businessName,
          status,
          confirmedCount,
          updatedCount,
          rejectedCount,
          confirmedAmountUsd: supplierOrder.confirmedAmountUsd,
        },
      });

      logger.dev('Created admin notifications for supplier order response');
    } catch (error) {
      logger.error('Failed to create admin in-app notifications:', error);
    }

    // Get all admin users for email notifications
    const adminUsers = await db
      .select({
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.role, 'admin'));

    if (adminUsers.length === 0) {
      logger.warn('No admin users found for email notification');
      return;
    }

    // Send email to each admin
    const emailPromises = adminUsers.map(async (admin) => {
      try {
        await loops.sendTransactionalEmail({
          transactionalId: 'source-supplier-order-response',
          email: admin.email,
          dataVariables: {
            adminName: admin.name,
            partnerName: partner.businessName,
            orderNumber: supplierOrder.orderNumber,
            customerPoNumber: customerPo?.ccPoNumber ?? 'N/A',
            status: status.charAt(0).toUpperCase() + status.slice(1),
            confirmedCount: String(confirmedCount),
            updatedCount: String(updatedCount),
            rejectedCount: String(rejectedCount),
            totalAmount: totalFormatted,
            customerPoUrl,
          },
        });

        logger.dev(`Sent supplier order response notification to admin: ${admin.email}`);
      } catch (error) {
        logger.error(`Failed to send notification to admin ${admin.email}:`, error);
      }
    });

    await Promise.allSettled(emailPromises);
  } catch (error) {
    logger.error('Failed to notify admins of supplier order response:', error);
  }
};

export default notifyAdminOfSupplierOrderResponse;
