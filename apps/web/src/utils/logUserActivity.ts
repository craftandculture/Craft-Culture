import db from '@/database/client';
import { userActivityLogs } from '@/database/schema';

export interface LogActivityOptions {
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Log user activity for admin monitoring
 *
 * @example
 *   await logUserActivity({
 *     userId: user.id,
 *     action: 'quote_downloaded',
 *     entityType: 'quote',
 *     entityId: quoteId,
 *     metadata: { productCount: 5, currency: 'AED' },
 *   });
 *
 * @param options - Activity logging options
 */
const logUserActivity = async (options: LogActivityOptions) => {
  const { userId, action, entityType, entityId, metadata, ipAddress, userAgent } =
    options;

  try {
    await db.insert(userActivityLogs).values({
      userId,
      action,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      metadata: metadata ?? null,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });
  } catch (error) {
    // Log error but don't throw - activity logging shouldn't break core functionality
    console.error('Failed to log user activity:', error);
  }
};

export default logUserActivity;
