import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { users } from '@/database/schema';
import type { Quote } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

/**
 * Notify the quote owner when C&C starts reviewing their quote
 *
 * @param quote - The quote being reviewed
 */
const notifyUserOfReviewStart = async (quote: Quote) => {
  try {
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

    const quoteUrl = `${serverConfig.appUrl}/platform/my-quotes?quoteId=${quote.id}`;

    // Create in-app notification
    await createNotification({
      userId: quote.userId,
      type: 'cc_review_started',
      title: 'Quote Under Review',
      message: `Your quote "${quote.name}" is now being reviewed by the C&C team`,
      entityType: 'quote',
      entityId: quote.id,
      actionUrl: quoteUrl,
      metadata: {
        quoteName: quote.name,
      },
    });

    try {
      // Loops template: Quote Review Started
      await loops.sendTransactionalEmail({
        transactionalId: 'cmjo8k5o27jt80izpamnt25fp',
        email: quoteOwner.email,
        dataVariables: {
          userName: quoteOwner.name,
          quoteName: quote.name,
          quoteId: quote.id,
          reviewStartedDate: new Date().toLocaleDateString(),
          quoteUrl,
          ccNotes: quote.ccNotes || '',
        },
      });

      logger.dev(`Sent review start notification to user: ${quoteOwner.email}`);
    } catch (error) {
      logger.error(`Failed to send review start notification to user ${quoteOwner.email}:`, error);
    }
  } catch (error) {
    logger.error('Failed to notify user of review start:', error);
  }
};

export default notifyUserOfReviewStart;
