import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { partners, sourceRfqs, users } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

interface NotifyPartnerOfRfqParams {
  rfqId: string;
  partnerId: string;
}

/**
 * Notify a wine partner when they receive a new SOURCE RFQ
 *
 * Creates an in-app notification and sends an email via Loops.
 *
 * @param params - The RFQ ID and partner ID
 */
const notifyPartnerOfRfq = async ({ rfqId, partnerId }: NotifyPartnerOfRfqParams) => {
  try {
    // Get RFQ details
    const [rfq] = await db
      .select({
        rfqNumber: sourceRfqs.rfqNumber,
        name: sourceRfqs.name,
        itemCount: sourceRfqs.itemCount,
        responseDeadline: sourceRfqs.responseDeadline,
      })
      .from(sourceRfqs)
      .where(eq(sourceRfqs.id, rfqId));

    if (!rfq) {
      logger.error('RFQ not found for notification', { rfqId });
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

    // Use user email if available, otherwise fall back to business email
    const notificationEmail = userEmail || partner.businessEmail;
    const recipientName = userName || partner.businessName;

    if (!notificationEmail) {
      logger.error('No email found for partner notification', { partnerId });
      return;
    }

    const rfqUrl = `${serverConfig.appUrl}/platform/partner/source/${rfqId}`;

    // Format deadline for display
    const deadlineStr = rfq.responseDeadline
      ? new Date(rfq.responseDeadline).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'No deadline set';

    // Create in-app notification (only if partner has a platform account)
    if (partner.userId) {
      await createNotification({
        userId: partner.userId,
        type: 'rfq_received',
        title: 'New RFQ Received',
        message: `You have received a new sourcing request: ${rfq.name} (${rfq.itemCount} items)`,
        entityType: 'source_rfq',
        entityId: rfqId,
        actionUrl: rfqUrl,
        metadata: {
          rfqNumber: rfq.rfqNumber,
          rfqName: rfq.name,
          itemCount: rfq.itemCount,
          responseDeadline: rfq.responseDeadline,
        },
      });
    }

    // Send email notification via Loops
    try {
      // TODO: Create template in Loops with ID 'source-rfq-received'
      await loops.sendTransactionalEmail({
        transactionalId: 'source-rfq-received',
        email: notificationEmail,
        dataVariables: {
          partnerName: recipientName,
          rfqNumber: rfq.rfqNumber,
          rfqName: rfq.name,
          itemCount: String(rfq.itemCount),
          responseDeadline: deadlineStr,
          rfqUrl,
        },
      });

      logger.dev(`Sent RFQ notification to partner: ${notificationEmail}`);
    } catch (error) {
      logger.error(`Failed to send RFQ email notification to ${notificationEmail}:`, error);
    }
  } catch (error) {
    logger.error('Failed to notify partner of RFQ:', error);
  }
};

export default notifyPartnerOfRfq;
