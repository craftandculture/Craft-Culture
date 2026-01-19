import db from '@/database/client';
import type { Notification, User } from '@/database/schema';
import { notifications } from '@/database/schema';
import logger from '@/utils/logger';

interface CreateNotificationParams {
  userId: string;
  partnerId?: string; // Partner context - used to filter notifications when user switches partners
  type: Notification['type'];
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Checks if a notification type is disabled for a user
 *
 * @param user - The user to check preferences for
 * @param notificationType - The notification type to check
 * @returns true if the notification should be skipped
 */
const isNotificationDisabled = (
  user: User,
  notificationType: string,
): boolean => {
  const prefs = user.notificationPreferences;
  if (!prefs) return false;

  // Admin-disabled takes precedence
  if (prefs.adminDisabledTypes?.includes(notificationType)) {
    return true;
  }

  // Check user-disabled types
  if (prefs.disabledTypes?.includes(notificationType)) {
    return true;
  }

  return false;
};

/**
 * Creates an in-app notification for a user
 *
 * @param params - Notification parameters
 * @returns The created notification or null if user doesn't exist or notification is disabled
 */
const createNotification = async (params: CreateNotificationParams) => {
  const { userId, partnerId, type, title, message, entityType, entityId, actionUrl, metadata } = params;

  // Verify user exists and get their notification preferences
  const user = await db.query.users.findFirst({
    where: { id: userId },
    columns: {
      id: true,
      notificationPreferences: true,
    },
  });

  if (!user) {
    logger.error('Cannot create notification: User not found', { userId });
    return null;
  }

  // Check if this notification type is disabled for this user
  if (isNotificationDisabled(user as User, type)) {
    return null;
  }

  const [notification] = await db
    .insert(notifications)
    .values({
      userId,
      partnerId,
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
