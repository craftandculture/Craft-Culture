import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { notifications, users } from '@/database/schema';

interface CreateNotificationParams {
  userId: string;
  type:
    | 'buy_request_submitted'
    | 'cc_review_started'
    | 'quote_confirmed'
    | 'revision_requested'
    | 'po_submitted'
    | 'po_confirmed'
    | 'payment_received'
    | 'order_delivered';
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Creates an in-app notification for a user
 *
 * @param params - Notification parameters
 * @returns The created notification or null if user doesn't exist
 */
const createNotification = async (params: CreateNotificationParams) => {
  const { userId, type, title, message, entityType, entityId, actionUrl, metadata } = params;

  // Verify user exists
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    console.error('Cannot create notification: User not found', { userId });
    return null;
  }

  const [notification] = await db
    .insert(notifications)
    .values({
      userId,
      type,
      title,
      message,
      entityType,
      entityId,
      actionUrl,
      metadata,
    })
    .returning();

  return notification;
};

export default createNotification;
