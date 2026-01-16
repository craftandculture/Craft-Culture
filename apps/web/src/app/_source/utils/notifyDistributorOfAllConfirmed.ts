import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { sourceCustomerPos, sourceSupplierOrders } from '@/database/schema';
import loops from '@/lib/loops/client';
import logger from '@/utils/logger';

interface NotifyDistributorOfAllConfirmedParams {
  customerPoId: string;
}

/**
 * Notify a distributor when all supplier orders have been confirmed
 *
 * Sends an email letting them know their order is ready to proceed
 * with shipment coordination.
 *
 * @param params - The customer PO ID
 */
const notifyDistributorOfAllConfirmed = async ({
  customerPoId,
}: NotifyDistributorOfAllConfirmedParams) => {
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
        totalBuyPriceUsd: sourceCustomerPos.totalBuyPriceUsd,
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

    // Count confirmed supplier orders
    const supplierOrders = await db
      .select({
        id: sourceSupplierOrders.id,
        status: sourceSupplierOrders.status,
        confirmedAmountUsd: sourceSupplierOrders.confirmedAmountUsd,
      })
      .from(sourceSupplierOrders)
      .where(eq(sourceSupplierOrders.customerPoId, customerPoId));

    const confirmedCount = supplierOrders.filter(
      (o) => o.status === 'confirmed'
    ).length;
    const totalCount = supplierOrders.length;

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
        transactionalId: 'source-customer-po-ready',
        email: customerPo.customerEmail,
        dataVariables: {
          customerName: recipientName,
          ccPoNumber: customerPo.ccPoNumber,
          customerPoNumber: customerPo.poNumber,
          itemCount: String(customerPo.itemCount ?? 0),
          confirmedCount: String(confirmedCount),
          totalCount: String(totalCount),
          totalAmount: totalFormatted,
        },
      });

      logger.dev(`Sent all confirmed notification to: ${customerPo.customerEmail}`);
    } catch (error) {
      logger.error(
        `Failed to send all confirmed email to ${customerPo.customerEmail}:`,
        error
      );
    }
  } catch (error) {
    logger.error('Failed to notify distributor of all confirmed:', error);
  }
};

export default notifyDistributorOfAllConfirmed;
