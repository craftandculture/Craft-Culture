import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { partners, sourceRfqs, users } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

interface NotifyPartnerOfQuoteSelectionParams {
  rfqId: string;
  partnerId: string;
  selectedItemCount: number;
  totalAmountUsd: number;
}

/**
 * Notify a wine partner when their quotes have been selected
 *
 * Creates an in-app notification and sends email via Loops.
 *
 * @param params - The RFQ ID, partner ID, count of selected items, and total amount
 */
const notifyPartnerOfQuoteSelection = async ({
  rfqId,
  partnerId,
  selectedItemCount,
  totalAmountUsd,
}: NotifyPartnerOfQuoteSelectionParams) => {
  try {
    // Get RFQ details
    const [rfq] = await db
      .select({
        rfqNumber: sourceRfqs.rfqNumber,
        name: sourceRfqs.name,
      })
      .from(sourceRfqs)
      .where(eq(sourceRfqs.id, rfqId));

    if (!rfq) {
      logger.error('RFQ not found for quote selection notification', { rfqId });
      return;
    }

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

    const rfqUrl = `${serverConfig.appUrl}/platform/partner/source/${rfqId}`;

    // Format total for display
    const totalFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(totalAmountUsd);

    // Create in-app notification (only if partner has a platform account)
    if (partner.userId) {
      await createNotification({
        userId: partner.userId,
        partnerId,
        type: 'rfq_quotes_selected',
        title: 'Quotes Selected',
        message: `${selectedItemCount} of your quotes were selected for ${rfq.name} (${totalFormatted} total)`,
        entityType: 'source_rfq',
        entityId: rfqId,
        actionUrl: rfqUrl,
        metadata: {
          rfqNumber: rfq.rfqNumber,
          rfqName: rfq.name,
          selectedItemCount,
          totalAmountUsd,
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
        transactionalId: 'source-quotes-selected',
        email: recipientEmail,
        dataVariables: {
          partnerName: recipientName,
          rfqNumber: rfq.rfqNumber,
          rfqName: rfq.name,
          selectedItemCount: String(selectedItemCount),
          totalAmount: totalFormatted,
          rfqUrl,
        },
      });

      logger.dev(`Sent quote selection notification to: ${recipientEmail}`);
    } catch (error) {
      logger.error(`Failed to send quote selection email to ${recipientEmail}:`, error);
    }
  } catch (error) {
    logger.error('Failed to notify partner of quote selection:', error);
  }
};

export default notifyPartnerOfQuoteSelection;
