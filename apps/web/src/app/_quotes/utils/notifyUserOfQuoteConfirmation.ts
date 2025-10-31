import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';
import type { Quote } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';


/**
 * Notify the quote owner when C&C confirms their quote
 *
 * @param quote - The confirmed quote
 */
const notifyUserOfQuoteConfirmation = async (quote: Quote) => {
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
      // TODO: Create template in Loops with ID 'quote-confirmed-by-cc'
      await loops.sendTransactionalEmail({
        transactionalId: 'quote-confirmed-by-cc',
        email: quoteOwner.email,
        dataVariables: {
          userName: quoteOwner.name,
          quoteName: quote.name,
          quoteId: quote.id,
          totalUsd: quote.totalUsd.toFixed(2),
          ccConfirmationNotes: quote.ccConfirmationNotes || 'No additional notes',
          confirmedDate: new Date().toLocaleDateString(),
          quoteUrl,
        },
      });

      logger.dev(`Sent quote confirmation notification to user: ${quoteOwner.email}`);
    } catch (error) {
      logger.error(`Failed to send confirmation notification to user ${quoteOwner.email}:`, error);
    }
  } catch (error) {
    logger.error('Failed to notify user of quote confirmation:', error);
  }
};

export default notifyUserOfQuoteConfirmation;
