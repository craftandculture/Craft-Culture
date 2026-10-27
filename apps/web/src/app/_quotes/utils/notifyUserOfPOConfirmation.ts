import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { users } from '@/database/schema';
import type { Quote } from '@/database/schema';
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

    const quoteUrl = `${serverConfig.appUrl}/platform/my-quotes?quoteId=${quote.id}`;

    // Create in-app notification
    await createNotification({
      userId: quote.userId,
      type: 'po_confirmed',
      title: 'PO Confirmed',
      message: `Your purchase order for "${quote.name}" has been confirmed`,
      entityType: 'quote',
      entityId: quote.id,
      actionUrl: quoteUrl,
      metadata: {
        quoteName: quote.name,
        poNumber: quote.poNumber,
        totalUsd: quote.totalUsd,
      },
    });

    /*
      No Loops template exists for this email yet ('quote-po-confirmed' was a
      placeholder id, so every send failed quietly). The customer still gets
      the in-app notification above; the email is skipped, loudly, until a
      real template id is set here.
    */
    logger.error(
      'PO confirmation email skipped: no Loops template is set up for it (in-app notification sent)',
      { quoteId: quote.id },
    );
  } catch (error) {
    logger.error('Failed to notify user of PO confirmation:', error);
  }
};

export default notifyUserOfPOConfirmation;
