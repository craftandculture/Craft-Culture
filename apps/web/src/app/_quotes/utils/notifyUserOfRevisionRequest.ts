import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
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

    const quoteUrl = `${serverConfig.appUrl}/platform/my-quotes?quoteId=${quote.id}`;

    // Create in-app notification
    await createNotification({
      userId: quote.userId,
      type: 'revision_requested',
      title: 'Revision Requested',
      message: `The C&C team has requested revisions on your quote "${quote.name}"`,
      entityType: 'quote',
      entityId: quote.id,
      actionUrl: quoteUrl,
      metadata: {
        quoteName: quote.name,
        revisionReason: quote.revisionReason,
      },
    });

    try {
      // TODO: Create template in Loops with ID 'quote-revision-requested'
      await loops.sendTransactionalEmail({
        transactionalId: 'cmjo9lc6213bd0i0vxkpw0mae',
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
