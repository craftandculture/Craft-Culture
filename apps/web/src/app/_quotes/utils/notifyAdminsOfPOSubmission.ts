import { eq } from 'drizzle-orm';

import createAdminNotifications from '@/app/_notifications/utils/createAdminNotifications';
import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';
import db from '@/database/client';
import { users } from '@/database/schema';
import type { Quote } from '@/database/schema';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

/**
 * Notify all admin users when a user submits a PO
 *
 * @param quote - The quote with submitted PO
 */
const notifyAdminsOfPOSubmission = async (quote: Quote) => {
  try {
    // Query all admin users
    // C&C staff only: a partner holding an admin login must not receive
    // other customers' orders
    const adminUsers = (
      await db
        .select({
          email: users.email,
          name: users.name,
          role: users.role,
        })
        .from(users)
        .where(eq(users.role, 'admin'))
    ).filter(isTeamMember);

    if (adminUsers.length === 0) {
      logger.warn('No admin users found to notify of PO submission');
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
      type: 'po_submitted',
      title: 'PO Submitted',
      message: `${quoteOwner.name || quoteOwner.email} submitted a PO for "${quote.name}"`,
      entityType: 'quote',
      entityId: quote.id,
      actionUrl: reviewUrl,
      metadata: {
        quoteName: quote.name,
        poNumber: quote.poNumber,
        customerName: quoteOwner.name,
        customerEmail: quoteOwner.email,
        totalUsd: quote.totalUsd,
      },
    });

    /*
      No Loops template exists for this email yet ('quote-po-submitted' was a
      placeholder id, so every send failed quietly). Admins still get the
      in-app notification above; the email is skipped, loudly, until a real
      template id is set here.
    */
    logger.error(
      'PO submission email skipped: no Loops template is set up for it (in-app notification sent)',
      { quoteId: quote.id, recipients: adminUsers.length },
    );
  } catch (error) {
    logger.error('Failed to notify admins of PO submission:', error);
  }
};

export default notifyAdminsOfPOSubmission;
