'use client';

import { IconBellOff, IconChecks } from '@tabler/icons-react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { format, isToday, isYesterday } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import type { Notification } from '@/database/schema';
import { useTRPCClient } from '@/lib/trpc/browser';

import NotificationItem from './NotificationItem';
import notificationAreas from '../constants/notificationAreas';

type View = 'action' | 'unread' | 'all';

export interface NotificationFeedProps {
  /** The drawer polls faster and loads fewer per page than the full page */
  variant: 'drawer' | 'page';
  /** Called after following a notification's link, e.g. to close the drawer */
  onNavigate?: () => void;
}

const dayLabel = (date: Date) => {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE d MMMM');
};

const EMPTY: Record<View, string> = {
  action: 'Nothing needs your action.',
  unread: 'You are all caught up.',
  all: 'No notifications yet.',
};

/**
 * Filterable, day-grouped list of the current user's notifications
 *
 * Shared by the drawer behind the bell and the Notifications page, so the two
 * can never disagree. Opens on "Needs action" when anything does, otherwise on
 * everything.
 */
const NotificationFeed = ({ variant, onNavigate }: NotificationFeedProps) => {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const pageSize = variant === 'drawer' ? 20 : 40;

  const { data: counts } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => trpcClient.notifications.getUnreadCount.query(),
    refetchInterval: 10000,
  });

  const [chosenView, setView] = useState<View | null>(null);
  const [area, setArea] = useState<string>('');
  const view: View =
    chosenView ?? ((counts?.actionCount ?? 0) > 0 ? 'action' : 'all');

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['notifications-list', view, area, pageSize],
      queryFn: ({ pageParam }) =>
        trpcClient.notifications.getMany.query({
          limit: pageSize,
          cursor: pageParam,
          unreadOnly: view === 'unread',
          actionOnly: view === 'action',
          area: area || undefined,
        }),
      initialPageParam: 0,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      refetchInterval: variant === 'drawer' ? 5000 : 30000,
    });

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data],
  );

  const groups = useMemo(() => {
    const out: { label: string; items: Notification[] }[] = [];
    for (const n of items) {
      const label = dayLabel(new Date(n.createdAt));
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(n);
      else out.push({ label, items: [n] });
    }
    return out;
  }, [items]);

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ['notifications-unread-count'],
    });
    void queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
  };

  const markRead = async (n: Notification) => {
    if (n.isRead) return;
    await trpcClient.notifications.markAsRead.mutate({ notificationId: n.id });
    refresh();
  };

  const open = async (n: Notification) => {
    await markRead(n);
    if (n.entityType === 'quote') {
      void queryClient.invalidateQueries({ queryKey: ['quotes.getMany'] });
      void queryClient.invalidateQueries({ queryKey: ['quotes.get'] });
    }
    if (n.entityType === 'private_client_order') {
      void queryClient.invalidateQueries({
        queryKey: ['privateClientOrders'],
      });
    }
    if (n.actionUrl) {
      onNavigate?.();
      router.push(n.actionUrl);
    }
  };

  const markAllRead = async () => {
    await trpcClient.notifications.markAllAsRead.mutate();
    refresh();
  };

  const tabs: { id: View; label: string; count?: number }[] = [
    { id: 'action', label: 'Needs action', count: counts?.actionCount },
    { id: 'unread', label: 'Unread', count: counts?.count },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Filters */}
      <div className="flex flex-col gap-3 border-b border-border-muted px-5 pb-3">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist">
          {tabs.map((tab) => {
            const active = view === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-text-primary text-surface-primary'
                    : 'bg-fill-muted text-text-muted hover:text-text-primary'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
                      active
                        ? 'bg-surface-primary/20'
                        : tab.id === 'action'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
                          : 'bg-surface-muted'
                    }`}
                  >
                    {tab.count > 99 ? '99+' : tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-3">
          <label className="sr-only" htmlFor={`notification-area-${variant}`}>
            Area
          </label>
          <select
            id={`notification-area-${variant}`}
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="h-8 rounded-md border border-border-muted bg-surface-primary px-2 text-xs text-text-primary"
          >
            <option value="">All areas</option>
            {notificationAreas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          {(counts?.count ?? 0) > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-text-muted hover:bg-fill-muted hover:text-text-primary"
            >
              <Icon icon={IconChecks} size="xs" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-3 px-5 py-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="size-9 animate-pulse rounded-lg bg-fill-muted" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="h-3.5 w-3/5 animate-pulse rounded bg-fill-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-fill-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-16 text-center">
            <Icon icon={IconBellOff} size="lg" colorRole="muted" />
            <p className="text-sm text-text-muted">{EMPTY[view]}</p>
            {view !== 'all' && (
              <button
                type="button"
                onClick={() => setView('all')}
                className="text-xs font-medium text-text-primary underline underline-offset-2"
              >
                Show all notifications
              </button>
            )}
          </div>
        ) : (
          <>
            {groups.map((group) => (
              <section key={group.label}>
                <h3 className="sticky top-0 z-10 border-b border-border-muted bg-surface-muted/95 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted backdrop-blur">
                  {group.label}
                </h3>
                <div className="divide-y divide-border-muted">
                  {group.items.map((n) => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      onOpen={open}
                      onMarkRead={markRead}
                    />
                  ))}
                </div>
              </section>
            ))}
            {hasNextPage && (
              <div className="flex justify-center px-5 py-4">
                <button
                  type="button"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="rounded-md border border-border-muted px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-fill-muted disabled:opacity-50"
                >
                  {isFetchingNextPage ? 'Loading…' : 'Load older'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationFeed;
