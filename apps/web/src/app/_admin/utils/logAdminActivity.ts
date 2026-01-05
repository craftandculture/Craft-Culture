import db from '@/database/client';
import { adminActivityLogs } from '@/database/schema';

export type AdminAction =
  | 'user.viewed'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.approved'
  | 'user.rejected'
  | 'user.email_changed'
  | 'quote.viewed'
  | 'quote.created'
  | 'quote.updated'
  | 'quote.deleted'
  | 'quote.downloaded'
  | 'quote.approved'
  | 'quote.revision_requested'
  | 'payment.confirmed'
  | 'product.viewed'
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'pricing_model.viewed'
  | 'pricing_model.created'
  | 'pricing_model.updated'
  | 'pricing_model.deleted'
  | 'admin.login'
  | 'admin.logout'
  | 'settings.updated';

interface LogAdminActivityParams {
  adminId: string;
  action: AdminAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log admin activity for audit trail
 *
 * @example
 *   await logAdminActivity({
 *     adminId: user.id,
 *     action: 'user.viewed',
 *     entityType: 'user',
 *     entityId: viewedUser.id,
 *     metadata: { viewedUserEmail: viewedUser.email },
 *   });
 */
const logAdminActivity = async (params: LogAdminActivityParams) => {
  try {
    await db.insert(adminActivityLogs).values({
      adminId: params.adminId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  } catch (error) {
    // Log error but don't throw - we don't want activity logging to break the app
    console.error('Failed to log admin activity:', error);
  }
};

export default logAdminActivity;
