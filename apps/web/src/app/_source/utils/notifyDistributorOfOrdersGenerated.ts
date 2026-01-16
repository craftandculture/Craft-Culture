import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { sourceCustomerPos, sourceSupplierOrders } from '@/database/schema';
import loops from '@/lib/loops/client';
import logger from '@/utils/logger';

interface NotifyDistributorOfOrdersGeneratedParams {
  customerPoId: string;
}

/**
 * Notify a distributor when supplier orders have been generated for their PO
 *
 * Sends an email update letting them know their order is being processed
 * and suppliers are being contacted.
 *
 * @param params - The customer PO ID
 */
const notifyDistributorOfOrdersGenerated = async ({
  customerPoId,
}: NotifyDistributorOfOrdersGeneratedParams) => {
  try {
    // Get customer PO details
    const [customerPo] = await db
      .select({
        ccPoNumber: sourceCustomerPos.ccPoNumber,
        poNumber: sourceCustomerPos.poNumber,
        customerName: sourceCustomerPos.customerName,
        customerCompany: sourceCustomerPos.customerCompany,
        customerEmail: sourceCustomerPos.customerEmail,
        totalSellPriceUsd: sourceCustomerPos.totalSellPriceUsd,
        itemCount: sourceCustomerPos.itemCount,
      })
      .from(sourceCustomerPos)
      .where(eq(sourceCustomerPos.id, customerPoId));

    if (!customerPo) {
      logger.error('Customer PO not found for notification', { customerPoId });
      return;
    }

    if (!customerPo.customerEmail) {
      logger.warn('No customer email for notification', { customerPoId });
      return;
    }

    // Count supplier orders
    const supplierOrders = await db
      .select({ id: sourceSupplierOrders.id })
      .from(sourceSupplierOrders)
      .where(eq(sourceSupplierOrders.customerPoId, customerPoId));

    const supplierCount = supplierOrders.length;

    // Format total for display
    const totalFormatted = customerPo.totalSellPriceUsd
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(customerPo.totalSellPriceUsd)
      : 'TBD';

    const recipientName =
      customerPo.customerCompany || customerPo.customerName || 'Valued Customer';

    // Send email notification via Loops
    try {
      await loops.sendTransactionalEmail({
        transactionalId: 'source-customer-po-orders-generated',
        email: customerPo.customerEmail,
        dataVariables: {
          customerName: recipientName,
          ccPoNumber: customerPo.ccPoNumber,
          customerPoNumber: customerPo.poNumber,
          itemCount: String(customerPo.itemCount ?? 0),
          supplierCount: String(supplierCount),
          totalAmount: totalFormatted,
        },
      });

      logger.dev(
        `Sent orders generated notification to: ${customerPo.customerEmail}`
      );
    } catch (error) {
      logger.error(
        `Failed to send orders generated email to ${customerPo.customerEmail}:`,
        error
      );
    }
  } catch (error) {
    logger.error('Failed to notify distributor of orders generated:', error);
  }
};

export default notifyDistributorOfOrdersGenerated;
