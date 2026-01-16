import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { sourceCustomerPoItems, sourceCustomerPos } from '@/database/schema';
import loops from '@/lib/loops/client';
import logger from '@/utils/logger';

interface NotifyDistributorOfCustomerPoReceivedParams {
  customerPoId: string;
}

/**
 * Notify a distributor when their Customer PO has been received
 *
 * Sends an email confirmation with PO details and item count.
 *
 * @param params - The customer PO ID
 */
const notifyDistributorOfCustomerPoReceived = async ({
  customerPoId,
}: NotifyDistributorOfCustomerPoReceivedParams) => {
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
        createdAt: sourceCustomerPos.createdAt,
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

    // Get item count if not stored
    let itemCount = customerPo.itemCount;
    if (!itemCount) {
      const items = await db
        .select({ id: sourceCustomerPoItems.id })
        .from(sourceCustomerPoItems)
        .where(eq(sourceCustomerPoItems.customerPoId, customerPoId));
      itemCount = items.length;
    }

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
        transactionalId: 'source-customer-po-received',
        email: customerPo.customerEmail,
        dataVariables: {
          customerName: recipientName,
          ccPoNumber: customerPo.ccPoNumber,
          customerPoNumber: customerPo.poNumber,
          itemCount: String(itemCount ?? 0),
          totalAmount: totalFormatted,
        },
      });

      logger.dev(`Sent customer PO received notification to: ${customerPo.customerEmail}`);
    } catch (error) {
      logger.error(
        `Failed to send customer PO received email to ${customerPo.customerEmail}:`,
        error
      );
    }
  } catch (error) {
    logger.error('Failed to notify distributor of customer PO received:', error);
  }
};

export default notifyDistributorOfCustomerPoReceived;
