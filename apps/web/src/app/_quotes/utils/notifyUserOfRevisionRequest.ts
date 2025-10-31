import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';
import type { Quote } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';


/**
 * Notify the quote owner when C&C requests revisions
 *
 * @param quote - The quote requiring revision
 */
const notifyUserOfRevisionRequest = async (quote: Quote) => {
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
      // TODO: Create template in Loops with ID 'quote-revision-requested'
      await loops.sendTransactionalEmail({
        transactionalId: 'quote-revision-requested',
        email: quoteOwner.email,
        dataVariables: {
          userName: quoteOwner.name,
          quoteName: quote.name,
          quoteId: quote.id,
          revisionReason: quote.revisionReason || 'Revisions needed',
          requestedDate: new Date().toLocaleDateString(),
          quoteUrl,
        },
      });

      logger.dev(`Sent revision request notification to user: ${quoteOwner.email}`);
    } catch (error) {
      logger.error(`Failed to send revision notification to user ${quoteOwner.email}:`, error);
    }
  } catch (error) {
    logger.error('Failed to notify user of revision request:', error);
  }
};

export default notifyUserOfRevisionRequest;
