import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { partners, sourceRfqs, users } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

interface ContactEmail {
  email: string;
  name: string;
}

interface NotifyPartnerOfRfqParams {
  rfqId: string;
  partnerId: string;
  contactEmails?: ContactEmail[];
}

/**
 * Notify a wine partner when they receive a new SOURCE RFQ
 *
 * Creates an in-app notification and sends emails via Loops.
 * If specific contact emails are provided, sends to those contacts.
 * Otherwise falls back to partner's user email or business email.
 *
 * @param params - The RFQ ID, partner ID, and optional contact emails
 */
const notifyPartnerOfRfq = async ({
  rfqId,
  partnerId,
  contactEmails,
}: NotifyPartnerOfRfqParams) => {
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

    // Determine email recipients
    // If specific contacts were selected, use those
    // Otherwise fall back to user email or business email
    let recipients: ContactEmail[] = [];

    if (contactEmails && contactEmails.length > 0) {
      recipients = contactEmails;
    } else {
      const fallbackEmail = userEmail || partner.businessEmail;
      const fallbackName = userName || partner.businessName;
      if (fallbackEmail) {
        recipients = [{ email: fallbackEmail, name: fallbackName }];
      }
    }

    if (recipients.length === 0) {
      logger.error('No email recipients found for partner notification', { partnerId });
      return;
    }

    // Send email notification via Loops to all recipients
    for (const recipient of recipients) {
      try {
        await loops.sendTransactionalEmail({
          transactionalId: 'source-rfq-received',
          email: recipient.email,
          dataVariables: {
            partnerName: recipient.name,
            rfqNumber: rfq.rfqNumber,
            rfqName: rfq.name,
            itemCount: String(rfq.itemCount),
            responseDeadline: deadlineStr,
            rfqUrl,
          },
        });

        logger.dev(`Sent RFQ notification to: ${recipient.email}`);
      } catch (error) {
        logger.error(`Failed to send RFQ email notification to ${recipient.email}:`, error);
      }
    }
  } catch (error) {
    logger.error('Failed to notify partner of RFQ:', error);
  }
};

export default notifyPartnerOfRfq;
