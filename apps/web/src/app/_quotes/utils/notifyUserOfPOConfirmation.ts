import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';
import type { Quote } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';


/**
 * Notify the quote owner when C&C confirms their PO
 *
 * @param quote - The quote with confirmed PO
 */
const notifyUserOfPOConfirmation = async (quote: Quote) => {
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
      // TODO: Create template in Loops with ID 'quote-po-confirmed'
      await loops.sendTransactionalEmail({
        transactionalId: 'quote-po-confirmed',
        email: quoteOwner.email,
        dataVariables: {
          userName: quoteOwner.name,
          quoteName: quote.name,
          quoteId: quote.id,
          poNumber: quote.poNumber || 'N/A',
          totalUsd: quote.totalUsd.toFixed(2),
          poConfirmationNotes: quote.poConfirmationNotes || 'No additional notes',
          confirmedDate: new Date().toLocaleDateString(),
          quoteUrl,
        },
      });

      logger.dev(`Sent PO confirmation notification to user: ${quoteOwner.email}`);
    } catch (error) {
      logger.error(`Failed to send PO confirmation notification to user ${quoteOwner.email}:`, error);
    }
  } catch (error) {
    logger.error('Failed to notify user of PO confirmation:', error);
  }
};

export default notifyUserOfPOConfirmation;
