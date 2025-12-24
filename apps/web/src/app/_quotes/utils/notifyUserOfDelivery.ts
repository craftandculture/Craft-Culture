import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { users } from '@/database/schema';
import type { Quote } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

/**
 * Notify the quote owner when their order has been delivered
 *
 * @param quote - The delivered quote
 */
const notifyUserOfDelivery = async (quote: Quote) => {
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
      type: 'order_delivered',
      title: 'Order Delivered',
      message: `Your order "${quote.name}" has been delivered`,
      entityType: 'quote',
      entityId: quote.id,
      actionUrl: quoteUrl,
      metadata: {
        quoteName: quote.name,
      },
    });

    try {
      // TODO: Create template in Loops with ID 'quote-order-delivered'
      await loops.sendTransactionalEmail({
        transactionalId: 'quote-order-delivered',
        email: quoteOwner.email,
        dataVariables: {
          userName: quoteOwner.name,
          quoteName: quote.name,
          quoteId: quote.id,
          deliveredDate: new Date().toLocaleDateString(),
          quoteUrl,
        },
      });

      logger.dev(`Sent delivery notification to user: ${quoteOwner.email}`);
    } catch (error) {
      logger.error(`Failed to send delivery notification to user ${quoteOwner.email}:`, error);
    }
  } catch (error) {
    logger.error('Failed to notify user of delivery:', error);
  }
};

export default notifyUserOfDelivery;
