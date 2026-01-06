import { logger, schedules } from '@trigger.dev/sdk';
import { and, eq, gt, inArray, lt } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import {
  partners,
  sourceRfqPartners,
  sourceRfqs,
  users,
} from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import triggerDb from '@/trigger/triggerDb';

interface SendDeadlineReminderParams {
  rfqId: string;
  rfqNumber: string;
  rfqName: string;
  itemCount: number;
  responseDeadline: Date | null;
  partnerId: string;
  userId: string | null;
  businessName: string;
  businessEmail: string | null;
}

/**
 * Send a deadline reminder to a partner
 */
const sendDeadlineReminder = async ({
  rfqId,
  rfqNumber,
  rfqName,
  itemCount,
  responseDeadline,
  partnerId,
  userId,
  businessName,
  businessEmail,
}: SendDeadlineReminderParams) => {
  // Get user email if partner has a platform account
  let userEmail: string | null = null;
  let userName: string | null = null;

  if (userId) {
    const [user] = await triggerDb
      .select({
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (user) {
      userEmail = user.email;
      userName = user.name;
    }
  }

  const notificationEmail = userEmail || businessEmail;
  const recipientName = userName || businessName;

  if (!notificationEmail) {
    logger.warn('No email found for partner reminder', { partnerId });
    return;
  }

  const rfqUrl = `${serverConfig.appUrl}/platform/partner/source/${rfqId}`;

  // Format deadline for display
  const deadlineStr = responseDeadline
    ? new Date(responseDeadline).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Soon';

  // Calculate hours remaining
  const hoursRemaining = responseDeadline
    ? Math.round((responseDeadline.getTime() - Date.now()) / (1000 * 60 * 60))
    : null;

  // Create in-app notification (only if partner has a platform account)
  if (userId) {
    await createNotification({
      userId,
      type: 'rfq_deadline_reminder',
      title: 'RFQ Deadline Approaching',
      message: `Reminder: ${rfqName} (${itemCount} items) deadline in ${hoursRemaining} hours`,
      entityType: 'source_rfq',
      entityId: rfqId,
      actionUrl: rfqUrl,
      metadata: {
        rfqNumber,
        rfqName,
        itemCount,
        responseDeadline,
        hoursRemaining,
      },
    });
  }

  // Send email notification via Loops
  try {
    await loops.sendTransactionalEmail({
      transactionalId: 'source-deadline-reminder',
      email: notificationEmail,
      dataVariables: {
        partnerName: recipientName,
        rfqNumber,
        rfqName,
        itemCount: String(itemCount),
        responseDeadline: deadlineStr,
        hoursRemaining: hoursRemaining ? String(hoursRemaining) : '24',
        rfqUrl,
      },
    });

    logger.info(`Sent deadline reminder to ${notificationEmail} for RFQ ${rfqNumber}`);
  } catch (error) {
    logger.error('Failed to send deadline reminder email', {
      email: notificationEmail,
      rfqId,
      error,
    });
  }
};

/**
 * SOURCE RFQ Deadline Reminder Job
 *
 * Runs hourly to send reminder notifications to partners who haven't
 * responded to RFQs approaching their deadline.
 *
 * Sends reminders when:
 * - RFQ deadline is within the next 24-48 hours
 * - Partner status is 'pending' or 'viewed' (not yet submitted/declined)
 */
export const sourceDeadlineReminderJob = schedules.task({
  id: 'source-deadline-reminder',
  cron: {
    pattern: '0 * * * *', // Every hour
    timezone: 'Asia/Dubai',
  },
  async run() {
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Find RFQs with deadlines in the 24-48 hour window
    const rfqsWithUpcomingDeadlines = await triggerDb
      .select({
        id: sourceRfqs.id,
        rfqNumber: sourceRfqs.rfqNumber,
        name: sourceRfqs.name,
        itemCount: sourceRfqs.itemCount,
        responseDeadline: sourceRfqs.responseDeadline,
      })
      .from(sourceRfqs)
      .where(
        and(
          inArray(sourceRfqs.status, ['sent', 'collecting']),
          gt(sourceRfqs.responseDeadline, twentyFourHoursFromNow),
          lt(sourceRfqs.responseDeadline, fortyEightHoursFromNow),
        ),
      );

    if (rfqsWithUpcomingDeadlines.length === 0) {
      logger.info('No RFQs with upcoming deadlines found');
      return;
    }

    logger.info(
      `Found ${rfqsWithUpcomingDeadlines.length} RFQs with deadlines in 24-48 hours`,
    );

    let remindersCount = 0;

    for (const rfq of rfqsWithUpcomingDeadlines) {
      // Find partners who haven't responded
      const pendingPartners = await triggerDb
        .select({
          rfqPartnerId: sourceRfqPartners.id,
          partnerId: sourceRfqPartners.partnerId,
          businessName: partners.businessName,
          businessEmail: partners.businessEmail,
          userId: partners.userId,
        })
        .from(sourceRfqPartners)
        .innerJoin(partners, eq(sourceRfqPartners.partnerId, partners.id))
        .where(
          and(
            eq(sourceRfqPartners.rfqId, rfq.id),
            inArray(sourceRfqPartners.status, ['pending', 'viewed', 'in_progress']),
          ),
        );

      if (pendingPartners.length === 0) {
        logger.info(`No pending partners for RFQ ${rfq.rfqNumber}`);
        continue;
      }

      logger.info(
        `Sending deadline reminders for RFQ ${rfq.rfqNumber} to ${pendingPartners.length} partners`,
      );

      for (const partner of pendingPartners) {
        try {
          await sendDeadlineReminder({
            rfqId: rfq.id,
            rfqNumber: rfq.rfqNumber,
            rfqName: rfq.name,
            itemCount: rfq.itemCount,
            responseDeadline: rfq.responseDeadline,
            partnerId: partner.partnerId,
            userId: partner.userId,
            businessName: partner.businessName,
            businessEmail: partner.businessEmail,
          });
          remindersCount++;
        } catch (error) {
          logger.error('Failed to send deadline reminder', {
            rfqId: rfq.id,
            partnerId: partner.partnerId,
            error,
          });
        }
      }
    }

    logger.info(`Sent ${remindersCount} deadline reminders`);
  },
});
