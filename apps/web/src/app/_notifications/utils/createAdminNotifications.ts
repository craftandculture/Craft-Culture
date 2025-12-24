import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { notifications, users } from '@/database/schema';

interface CreateAdminNotificationsParams {
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
 * Creates in-app notifications for all admin users
 *
 * @param params - Notification parameters
 * @returns Array of created notifications
 */
const createAdminNotifications = async (params: CreateAdminNotificationsParams) => {
  const { type, title, message, entityType, entityId, actionUrl, metadata } = params;

  // Get all admin users
  const adminUsers = await db.query.users.findMany({
    where: eq(users.role, 'admin'),
  });

  if (adminUsers.length === 0) {
    console.warn('No admin users found to notify');
    return [];
  }

  // Create notifications for all admins
  const notificationValues = adminUsers.map((admin) => ({
    userId: admin.id,
    type,
    title,
    message,
    entityType,
    entityId,
    actionUrl,
    metadata,
  }));

  const createdNotifications = await db
    .insert(notifications)
    .values(notificationValues)
    .returning();

  return createdNotifications;
};

export default createAdminNotifications;
