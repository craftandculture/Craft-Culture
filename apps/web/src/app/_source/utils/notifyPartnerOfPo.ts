import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { partners, sourcePurchaseOrders, sourceRfqs, users } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

interface NotifyPartnerOfPoParams {
  poId: string;
  partnerId: string;
}

/**
 * Notify a wine partner when they receive a Purchase Order
 *
 * Creates an in-app notification and sends email via Loops.
 *
 * @param params - The PO ID and partner ID
 */
const notifyPartnerOfPo = async ({ poId, partnerId }: NotifyPartnerOfPoParams) => {
  try {
    // Get PO details with RFQ info
    const [po] = await db
      .select({
        poNumber: sourcePurchaseOrders.poNumber,
        totalAmountUsd: sourcePurchaseOrders.totalAmountUsd,
        rfqId: sourcePurchaseOrders.rfqId,
      })
      .from(sourcePurchaseOrders)
      .where(eq(sourcePurchaseOrders.id, poId));

    if (!po) {
      logger.error('PO not found for notification', { poId });
      return;
    }

    // Get RFQ details for context
    const [rfq] = await db
      .select({
        rfqNumber: sourceRfqs.rfqNumber,
        name: sourceRfqs.name,
      })
      .from(sourceRfqs)
      .where(eq(sourceRfqs.id, po.rfqId));

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

    const poUrl = `${serverConfig.appUrl}/platform/partner/source/orders/${poId}`;

    // Format total for display
    const totalFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(po.totalAmountUsd ?? 0);

    // Create in-app notification (only if partner has a platform account)
    if (partner.userId) {
      await createNotification({
        userId: partner.userId,
        type: 'po_received',
        title: 'New Purchase Order',
        message: `You have received a new purchase order: ${po.poNumber} (${totalFormatted})`,
        entityType: 'source_po',
        entityId: poId,
        actionUrl: poUrl,
        metadata: {
          poNumber: po.poNumber,
          rfqNumber: rfq?.rfqNumber,
          rfqName: rfq?.name,
          totalAmountUsd: po.totalAmountUsd,
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
        transactionalId: 'source-po-received',
        email: recipientEmail,
        dataVariables: {
          partnerName: recipientName,
          poNumber: po.poNumber,
          rfqNumber: rfq?.rfqNumber ?? 'N/A',
          rfqName: rfq?.name ?? 'N/A',
          totalAmount: totalFormatted,
          poUrl,
        },
      });

      logger.dev(`Sent PO notification to: ${recipientEmail}`);
    } catch (error) {
      logger.error(`Failed to send PO email notification to ${recipientEmail}:`, error);
    }
  } catch (error) {
    logger.error('Failed to notify partner of PO:', error);
  }
};

export default notifyPartnerOfPo;
