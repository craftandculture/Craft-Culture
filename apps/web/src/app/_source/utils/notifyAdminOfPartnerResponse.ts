import { eq } from 'drizzle-orm';

import createAdminNotifications from '@/app/_notifications/utils/createAdminNotifications';
import db from '@/database/client';
import { partners, sourceRfqPartners, sourceRfqs, users } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

interface NotifyAdminOfPartnerResponseParams {
  rfqId: string;
  partnerId: string;
  quoteCount: number;
}

/**
 * Notify admins when a wine partner submits their quotes for a SOURCE RFQ
 *
 * Creates in-app notifications for all admins and sends email notifications.
 *
 * @param params - The RFQ ID, partner ID, and number of quotes submitted
 */
const notifyAdminOfPartnerResponse = async ({
  rfqId,
  partnerId,
  quoteCount,
}: NotifyAdminOfPartnerResponseParams) => {
  try {
    // Get RFQ details
    const [rfq] = await db
      .select({
        rfqNumber: sourceRfqs.rfqNumber,
        name: sourceRfqs.name,
        partnerCount: sourceRfqs.partnerCount,
      })
      .from(sourceRfqs)
      .where(eq(sourceRfqs.id, rfqId));

    if (!rfq) {
      logger.error('RFQ not found for admin notification', { rfqId });
      return;
    }

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

    // Count how many partners have responded
    const respondedPartners = await db
      .select()
      .from(sourceRfqPartners)
      .where(eq(sourceRfqPartners.rfqId, rfqId));

    const totalResponded = respondedPartners.filter(
      (p) => p.status === 'submitted' || p.status === 'declined',
    ).length;

    const rfqUrl = `${serverConfig.appUrl}/platform/admin/source/${rfqId}`;

    // Create in-app notifications for all admins
    try {
      await createAdminNotifications({
        type: 'rfq_response_submitted',
        title: 'RFQ Response Received',
        message: `${partner.businessName} submitted ${quoteCount} quotes for ${rfq.name} (${totalResponded}/${rfq.partnerCount} partners responded)`,
        entityType: 'source_rfq',
        entityId: rfqId,
        actionUrl: rfqUrl,
        metadata: {
          rfqNumber: rfq.rfqNumber,
          rfqName: rfq.name,
          partnerId,
          partnerName: partner.businessName,
          quoteCount,
          totalResponded,
          totalPartners: rfq.partnerCount,
        },
      });

      logger.dev('Created admin notifications for partner RFQ response');
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
        // TODO: Create template in Loops with ID 'source-response-submitted'
        await loops.sendTransactionalEmail({
          transactionalId: 'source-response-submitted',
          email: admin.email,
          dataVariables: {
            adminName: admin.name,
            partnerName: partner.businessName,
            rfqNumber: rfq.rfqNumber,
            rfqName: rfq.name,
            quoteCount: String(quoteCount),
            totalResponded: String(totalResponded),
            totalPartners: String(rfq.partnerCount),
            rfqUrl,
          },
        });

        logger.dev(`Sent RFQ response notification to admin: ${admin.email}`);
      } catch (error) {
        logger.error(`Failed to send notification to admin ${admin.email}:`, error);
      }
    });

    await Promise.allSettled(emailPromises);
  } catch (error) {
    logger.error('Failed to notify admins of partner response:', error);
  }
};

export default notifyAdminOfPartnerResponse;
