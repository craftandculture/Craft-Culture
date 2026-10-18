'use client';

import { IconArrowRight, IconCheck } from '@tabler/icons-react';
import { format, formatDistanceToNowStrict, isToday } from 'date-fns';

import Icon from '@/app/_ui/components/Icon/Icon';
import type { Notification } from '@/database/schema';

import notificationActionTypes from '../constants/notificationActionTypes';
import getNotificationReference from '../utils/getNotificationReference';
import getNotificationSubject from '../utils/getNotificationSubject';

export interface NotificationItemProps {
  notification: Notification;
  /** Hide the "Needs action" pill when the list is already filtered to it */
  showActionPill?: boolean;
  /** Open the notification: marks it read and follows its link */
  onOpen: (notification: Notification) => void;
  /** Mark it read without leaving the list */
  onMarkRead: (notification: Notification) => void;
}

const timeLabel = (date: Date) => {
  const minutes = (Date.now() - date.getTime()) / 60000;
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${formatDistanceToNowStrict(date)} ago`;
  return isToday(date) ? format(date, 'HH:mm') : format(date, 'd MMM, HH:mm');
};

/**
 * One notification in the drawer or on the Notifications page
 *
 * Leads with what it is about (icon, record and its number), then the full
 * title and message. Something waiting on the reader carries a button naming
 * what opening it does, so the list reads as a queue of next steps.
 */
const NotificationItem = ({
  notification,
  showActionPill = true,
  onOpen,
  onMarkRead,
}: NotificationItemProps) => {
  const unread = !notification.isRead;
  const needsAction =
    unread && notificationActionTypes.includes(notification.type);
  const subject = getNotificationSubject(notification);
  const reference = getNotificationReference(
    `${notification.title} ${notification.message}`,
  );
  const createdAt = new Date(notification.createdAt);
  // "Sale offer" reads "sale offer" mid-sentence; "UK move" keeps its capitals
  const noun = subject.noun.replace(/^[A-Z][a-z]/, (m) => m.toLowerCase());

  return (
    <div
      className={`group relative flex gap-3 px-5 py-3.5 transition-colors hover:bg-fill-muted/50 ${
        unread ? '' : 'opacity-75 hover:opacity-100'
      }`}
    >
      {unread && (
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 w-0.5 ${
            needsAction ? 'bg-amber-500' : 'bg-text-primary/40'
          }`}
        />
      )}

      <div
        className={`mt-0.5 flex size-9 flex-shrink-0 items-center justify-center rounded-lg ${
          needsAction
            ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
            : 'bg-fill-muted text-text-muted'
        }`}
      >
        <Icon icon={subject.icon} size="sm" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span className="font-medium uppercase tracking-wide">
            {subject.noun}
          </span>
          {reference && (
            <span className="rounded bg-fill-muted px-1.5 py-px font-mono text-[11px] text-text-primary">
              {reference}
            </span>
          )}
          <span
            className="ml-auto flex-shrink-0 tabular-nums"
            title={format(createdAt, 'd MMM yyyy, HH:mm')}
          >
            {timeLabel(createdAt)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onOpen(notification)}
          className="flex flex-col gap-0.5 text-left focus-visible:outline-none"
        >
          <span
            className={`text-sm leading-snug ${
              unread
                ? 'font-semibold text-text-primary'
                : 'font-medium text-text-primary'
            }`}
          >
            {notification.title}
          </span>
          <span className="line-clamp-3 text-[13px] leading-snug text-text-muted">
            {notification.message}
          </span>
        </button>

        {(needsAction || notification.actionUrl || unread) && (
          <div className="mt-1.5 flex items-center gap-2">
            {needsAction && showActionPill && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
                Needs action
              </span>
            )}
            {notification.actionUrl &&
              (needsAction ? (
                <button
                  type="button"
                  onClick={() => onOpen(notification)}
                  className="inline-flex items-center gap-1 rounded-md bg-text-primary px-2.5 py-1 text-xs font-medium text-surface-primary transition-opacity hover:opacity-90"
                >
                  Review {noun}
                  <Icon icon={IconArrowRight} size="xs" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpen(notification)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-text-muted opacity-0 transition-opacity hover:text-text-primary focus-visible:opacity-100 group-hover:opacity-100"
                >
                  View {noun}
                  <Icon icon={IconArrowRight} size="xs" />
                </button>
              ))}
            {unread && (
              <button
                type="button"
                onClick={() => onMarkRead(notification)}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-text-muted opacity-0 transition-opacity hover:bg-fill-muted hover:text-text-primary focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Icon icon={IconCheck} size="xs" />
                Mark read
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationItem;
