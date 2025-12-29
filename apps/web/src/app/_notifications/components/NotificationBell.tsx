'use client';

import { IconBell, IconCheck, IconChecks } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Icon from '@/app/_ui/components/Icon/Icon';
import Popover from '@/app/_ui/components/Popover/Popover';
import PopoverContent from '@/app/_ui/components/Popover/PopoverContent';
import PopoverTrigger from '@/app/_ui/components/Popover/PopoverTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { Notification } from '@/database/schema';
import { useTRPCClient } from '@/lib/trpc/browser';

/**
 * Play notification sound using Web Audio API
 * Creates a gentle two-tone chime sound without needing an audio file
 */
const playNotificationSound = () => {
  try {
    // Try to resume AudioContext if it's suspended (common on mobile)
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();

    // Resume if suspended (required for some browsers after user interaction)
    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }

    const now = audioContext.currentTime;

    // First tone - higher pitch
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.4, now + 0.02);
    gain1.gain.linearRampToValueAtTime(0, now + 0.15);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second tone - lower pitch (delayed)
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.frequency.setValueAtTime(660, now + 0.1); // E5
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0, now + 0.1);
    gain2.gain.linearRampToValueAtTime(0.4, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0, now + 0.35);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.35);

    // Clean up after sound completes
    setTimeout(() => {
      void audioContext.close();
    }, 500);
  } catch (error) {
    console.warn('Notification sound failed:', error);
  }
};

/**
 * Notification bell with dropdown showing recent notifications
 */
const NotificationBell = () => {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const previousCountRef = useRef<number | null>(null);
  const hasInteractedRef = useRef(false);

  // Track user interaction to enable sound (browser autoplay policy)
  useEffect(() => {
    const handleInteraction = () => {
      hasInteractedRef.current = true;
    };

    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  // Play sound and refresh relevant data when new notifications arrive
  const handleNewNotifications = useCallback((newCount: number) => {
    const prevCount = previousCountRef.current;

    // Only trigger if count increased
    if (prevCount !== null && newCount > prevCount) {
      // Play sound if user has interacted
      if (hasInteractedRef.current) {
        playNotificationSound();
      }

      // Invalidate admin queries to refresh data (e.g., quote approvals table)
      void queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    }

    previousCountRef.current = newCount;
  }, [queryClient]);

  // Fetch unread count
  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => trpcClient.notifications.getUnreadCount.query(),
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Play sound when unread count changes
  useEffect(() => {
    if (unreadData?.count !== undefined) {
      handleNewNotifications(unreadData.count);
    }
  }, [unreadData?.count, handleNewNotifications]);

  // Fetch recent notifications when popover is open
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => trpcClient.notifications.getMany.query({ limit: 10 }),
    enabled: isOpen,
  });

  const unreadCount = unreadData?.count ?? 0;
  const notifications: Notification[] = notificationsData?.data ?? [];

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already
    if (!notification.isRead) {
      await trpcClient.notifications.markAsRead.mutate({
        notificationId: notification.id,
      });
      // Invalidate queries
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    }

    // Navigate to action URL if present
    if (notification.actionUrl) {
      setIsOpen(false);
      router.push(notification.actionUrl);
    }
  };

  const handleMarkAllAsRead = async () => {
    await trpcClient.notifications.markAllAsRead.mutate();
    void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
  };

  const getNotificationIcon = (_type: Notification['type']) => {
    // All notifications use the same icon for simplicity
    return IconBell;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-fill-muted"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Icon icon={IconBell} size="md" colorRole="muted" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-fill-danger px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-muted px-4 py-3">
          <Typography variant="bodySm" className="font-semibold">
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
              <Icon icon={IconChecks} size="sm" />
              <span className="ml-1 text-xs">Mark all read</span>
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Typography variant="bodySm" colorRole="muted">
                Loading...
              </Typography>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Icon icon={IconBell} size="xl" colorRole="muted" className="mb-2" />
              <Typography variant="bodySm" colorRole="muted">
                No notifications yet
              </Typography>
            </div>
          ) : (
            <div className="divide-y divide-border-muted">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-fill-muted/50 ${
                    !notification.isRead ? 'bg-fill-brand/5' : ''
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                      !notification.isRead
                        ? 'bg-fill-brand/10 text-text-brand'
                        : 'bg-fill-muted text-text-muted'
                    }`}
                  >
                    <Icon icon={getNotificationIcon(notification.type)} size="sm" />
                  </div>
                  <div className="flex-1 space-y-0.5 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <Typography
                        variant="bodySm"
                        className={`truncate font-medium ${
                          !notification.isRead ? 'text-text-primary' : 'text-text-muted'
                        }`}
                      >
                        {notification.title}
                      </Typography>
                      {!notification.isRead && (
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-fill-brand" />
                      )}
                    </div>
                    <Typography
                      variant="bodyXs"
                      colorRole="muted"
                      className="line-clamp-2"
                    >
                      {notification.message}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" className="text-[10px]">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                      })}
                    </Typography>
                  </div>
                  {notification.isRead && (
                    <Icon
                      icon={IconCheck}
                      size="xs"
                      colorRole="muted"
                      className="mt-1 flex-shrink-0"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
