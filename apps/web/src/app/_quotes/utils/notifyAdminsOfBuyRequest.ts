import { eq } from 'drizzle-orm';

import createAdminNotifications from '@/app/_notifications/utils/createAdminNotifications';
import db from '@/database/client';
import { users } from '@/database/schema';
import type { Quote } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

/**
 * Notify all admin users when a user submits a buy request
 *
 * @param quote - The quote with submitted buy request
 */
const notifyAdminsOfBuyRequest = async (quote: Quote) => {
  try {
    // Query all admin users
    const adminUsers = await db
      .select({
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.role, 'admin'));

    if (adminUsers.length === 0) {
      logger.warn('No admin users found to notify of buy request');
      return;
    }

    // Get quote owner details
    const [quoteOwner] = await db
      .select({
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, quote.userId))
      .limit(1);

    if (!quoteOwner) {
      logger.error('Quote owner not found', { quoteId: quote.id });
      return;
    }

    const reviewUrl = `${serverConfig.appUrl}/platform/admin/quote-approvals`;

    // Create in-app notifications for all admins
    await createAdminNotifications({
      type: 'buy_request_submitted',
      title: 'New Buy Request',
      message: `${quoteOwner.name || quoteOwner.email} submitted a buy request for "${quote.name}"`,
      entityType: 'quote',
      entityId: quote.id,
      actionUrl: reviewUrl,
      metadata: {
        quoteName: quote.name,
        customerName: quoteOwner.name,
        customerEmail: quoteOwner.email,
        totalUsd: quote.totalUsd,
      },
    });

    // Send email to each admin
    const emailPromises = adminUsers.map(async (admin) => {
      try {
        // TODO: Create template in Loops with ID 'quote-buy-request-submitted'
        await loops.sendTransactionalEmail({
          transactionalId: 'quote-buy-request-submitted',
          email: admin.email,
          dataVariables: {
            adminName: admin.name,
            quoteName: quote.name,
            quoteId: quote.id,
            customerName: quoteOwner.name,
            customerEmail: quoteOwner.email,
            totalUsd: quote.totalUsd.toFixed(2),
            submittedDate: new Date().toLocaleDateString(),
            reviewUrl,
          },
        });

        logger.dev(`Sent buy request notification to admin: ${admin.email}`);
      } catch (error) {
        logger.error(`Failed to send notification to admin ${admin.email}:`, error);
      }
    });

    await Promise.allSettled(emailPromises);
  } catch (error) {
    logger.error('Failed to notify admins of buy request:', error);
  }
};

export default notifyAdminsOfBuyRequest;
