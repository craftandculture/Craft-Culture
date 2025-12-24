import { eq } from 'drizzle-orm';

import createAdminNotifications from '@/app/_notifications/utils/createAdminNotifications';
import db from '@/database/client';
import { users } from '@/database/schema';
import type { Quote } from '@/database/schema';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

/**
 * Notify all admin users when a B2C user submits payment proof
 *
 * @param quote - The quote with payment proof submitted
 */
const notifyAdminsOfPaymentProof = async (quote: Quote) => {
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
      logger.warn('No admin users found to notify of payment proof');
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
      type: 'payment_proof_submitted',
      title: 'Payment Proof Submitted',
      message: `${quoteOwner.name || quoteOwner.email} submitted payment proof for "${quote.name}"`,
      entityType: 'quote',
      entityId: quote.id,
      actionUrl: reviewUrl,
      metadata: {
        quoteName: quote.name,
        customerName: quoteOwner.name,
        customerEmail: quoteOwner.email,
        totalUsd: quote.totalUsd,
        paymentProofUrl: quote.paymentProofUrl,
      },
    });

    logger.dev(`Created payment proof notifications for ${adminUsers.length} admins`);
  } catch (error) {
    logger.error('Failed to notify admins of payment proof:', error);
  }
};

export default notifyAdminsOfPaymentProof;
