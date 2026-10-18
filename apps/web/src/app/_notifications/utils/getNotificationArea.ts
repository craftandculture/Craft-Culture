import type { Notification } from '@/database/schema';

import type { NotificationAreaId } from '../constants/notificationAreas';
import getNotificationCategories from '../data/getNotificationCategories';

type NotificationType = Notification['type'];

/*
  Types the preference catalogue does not list still need a home. Purchasing
  traffic files under purchasing; anything else falls to General.
*/
const EXTRA_AREA: Partial<Record<NotificationType, NotificationAreaId>> = {
  po_received: 'purchase_orders',
  supplier_order_received: 'purchase_orders',
  supplier_order_confirmed: 'purchase_orders',
  supplier_order_updated: 'purchase_orders',
  supplier_order_rejected: 'purchase_orders',
  supplier_order_reminder: 'purchase_orders',
  customer_po_received: 'purchase_orders',
  customer_po_orders_generated: 'purchase_orders',
  customer_po_ready: 'purchase_orders',
  cellar_purchase_expired: 'cellar',
};

const AREA_BY_TYPE = new Map<NotificationType, NotificationAreaId>(
  getNotificationCategories().flatMap((category) =>
    category.types.map(
      (t) => [t.type, category.id as NotificationAreaId] as const,
    ),
  ),
);

/**
 * The area a notification type belongs to
 *
 * @example
 *   getNotificationArea('cellar_release_submitted'); // 'admin'
 *
 * @param type - The notification type
 * @returns The area id, General when the type has no other home
 */
const getNotificationArea = (type: NotificationType) =>
  AREA_BY_TYPE.get(type) ?? EXTRA_AREA[type] ?? 'general';

export default getNotificationArea;
