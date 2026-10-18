import { IconAlertTriangle, IconBell } from '@tabler/icons-react';

import type { Notification } from '@/database/schema';

import getNotificationArea from './getNotificationArea';
import notificationAreas from '../constants/notificationAreas';

/**
 * The icon shown beside a notification
 *
 * Something that has lapsed shows a warning mark; everything else shows its
 * area's icon, so a mixed list can be read at a glance.
 *
 * @param type - The notification type
 * @returns A Tabler icon component
 */
const getNotificationIcon = (type: Notification['type']) => {
  if (type === 'document_expired' || type === 'cellar_purchase_expired') {
    return IconAlertTriangle;
  }
  const area = getNotificationArea(type);
  return notificationAreas.find((a) => a.id === area)?.icon ?? IconBell;
};

export default getNotificationIcon;
