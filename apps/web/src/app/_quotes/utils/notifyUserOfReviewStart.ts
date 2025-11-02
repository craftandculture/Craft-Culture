import { eq } from 'drizzle-orm';

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

    const quoteUrl = `${serverConfig.appUrl}/platform/quotes/${quote.id}`;

    try {
      // Loops template: Quote Review Started
      await loops.sendTransactionalEmail({
        transactionalId: 'cmhexu2adkscr1y0ia83rd76j',
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
