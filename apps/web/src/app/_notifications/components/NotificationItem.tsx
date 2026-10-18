'use client';

import { IconCheck, IconChevronRight } from '@tabler/icons-react';
import { format } from 'date-fns';

import Icon from '@/app/_ui/components/Icon/Icon';
import type { Notification } from '@/database/schema';

import notificationActionTypes from '../constants/notificationActionTypes';
import notificationAreas from '../constants/notificationAreas';
import getNotificationArea from '../utils/getNotificationArea';
import getNotificationIcon from '../utils/getNotificationIcon';

export interface NotificationItemProps {
  notification: Notification;
  /** Open the notification: marks it read and follows its link */
  onOpen: (notification: Notification) => void;
  /** Mark it read without leaving the list */
  onMarkRead: (notification: Notification) => void;
}

/**
 * One notification in the drawer or on the Notifications page
 *
 * Shows the full title and up to three lines of message. Something that needs
 * the reader's action and is still unread is marked so, and carries an "Open"
 * prompt, so the list can be scanned for what to do next.
 */
const NotificationItem = ({
  notification,
  onOpen,
  onMarkRead,
}: NotificationItemProps) => {
  const unread = !notification.isRead;
  const needsAction =
    unread && notificationActionTypes.includes(notification.type);
  const areaId = getNotificationArea(notification.type);
  const areaLabel =
    notificationAreas.find((a) => a.id === areaId)?.label ?? 'General';
  const createdAt = new Date(notification.createdAt);

  return (
    <div
      className={`group relative flex gap-3 px-5 py-4 transition-colors hover:bg-fill-muted/60 ${
        unread ? 'bg-surface-primary' : 'bg-surface-primary/60'
      }`}
    >
      {unread && (
        <span
          aria-hidden
          className="absolute left-2 top-6 size-1.5 rounded-full bg-text-primary"
        />
      )}
      <div
        className={`mt-0.5 flex size-9 flex-shrink-0 items-center justify-center rounded-lg ${
          needsAction
            ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30'
            : 'bg-fill-muted text-text-muted'
        }`}
      >
        <Icon icon={getNotificationIcon(notification.type)} size="sm" />
      </div>

      <button
        type="button"
        onClick={() => onOpen(notification)}
        className="flex min-w-0 flex-1 flex-col gap-1 text-left focus-visible:outline-none"
      >
        <span
          className={`text-sm leading-snug ${
            unread
              ? 'font-semibold text-text-primary'
              : 'font-medium text-text-muted'
          }`}
        >
          {notification.title}
        </span>
        <span className="line-clamp-3 text-[13px] leading-snug text-text-muted">
          {notification.message}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
          {needsAction && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
              Needs action
            </span>
          )}
          <span className="rounded-full bg-fill-muted px-2 py-0.5">
            {areaLabel}
          </span>
          <span title={format(createdAt, 'd MMM yyyy, HH:mm')}>
            {format(createdAt, 'HH:mm')}
          </span>
          {notification.actionUrl && (
            <span className="ml-auto inline-flex items-center gap-0.5 font-medium text-text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Open
              <Icon icon={IconChevronRight} size="xs" />
            </span>
          )}
        </span>
      </button>

      {unread && (
        <button
          type="button"
          onClick={() => onMarkRead(notification)}
          aria-label="Mark as read"
          title="Mark as read"
          className="flex size-7 flex-shrink-0 items-center justify-center self-start rounded-md text-text-muted opacity-0 transition-opacity hover:bg-fill-muted hover:text-text-primary focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Icon icon={IconCheck} size="xs" />
        </button>
      )}
    </div>
  );
};

export default NotificationItem;
