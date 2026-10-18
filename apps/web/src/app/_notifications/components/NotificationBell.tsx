'use client';

import {
  IconArrowUpRight,
  IconBell,
  IconSettings,
  IconX,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Sheet from '@/app/_ui/components/Sheet/Sheet';
import SheetClose from '@/app/_ui/components/Sheet/SheetClose';
import SheetContent from '@/app/_ui/components/Sheet/SheetContent';
import SheetDescription from '@/app/_ui/components/Sheet/SheetDescription';
import SheetTitle from '@/app/_ui/components/Sheet/SheetTitle';
import SheetTrigger from '@/app/_ui/components/Sheet/SheetTrigger';
import { useTRPCClient } from '@/lib/trpc/browser';

import NotificationFeed from './NotificationFeed';

// Global flag to track if user has interacted with the page
// Persists across component remounts
let hasUserInteracted = false;

// Set up global interaction tracking (runs once when module loads)
if (typeof window !== 'undefined') {
  const markInteracted = () => {
    hasUserInteracted = true;
  };
  // Track any user interaction
  window.addEventListener('click', markInteracted, { passive: true });
  window.addEventListener('keydown', markInteracted, { passive: true });
  window.addEventListener('touchstart', markInteracted, { passive: true });
}

/**
 * Play notification sound using Web Audio API
 * Creates a prominent three-tone chime sound without needing an audio file
 */
const playNotificationSound = async () => {
  try {
    // Check if user has interacted (required by browser autoplay policy)
    if (!hasUserInteracted) {
      console.log('Notification sound skipped: no user interaction yet');
      return;
    }

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();

    // Resume if suspended (required for some browsers after user interaction)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const now = audioContext.currentTime;

    // First tone - high pitch (attention grabber)
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.frequency.setValueAtTime(1047, now); // C6
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.7, now + 0.01);
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.1);
    gain1.gain.linearRampToValueAtTime(0, now + 0.2);
    osc1.start(now);
    osc1.stop(now + 0.2);

    // Second tone - mid pitch
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.frequency.setValueAtTime(880, now + 0.12); // A5
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.7, now + 0.13);
    gain2.gain.linearRampToValueAtTime(0.3, now + 0.22);
    gain2.gain.linearRampToValueAtTime(0, now + 0.35);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.35);

    // Third tone - higher pitch (pleasant resolution)
    const osc3 = audioContext.createOscillator();
    const gain3 = audioContext.createGain();
    osc3.connect(gain3);
    gain3.connect(audioContext.destination);
    osc3.frequency.setValueAtTime(1319, now + 0.25); // E6
    osc3.type = 'sine';
    gain3.gain.setValueAtTime(0, now + 0.25);
    gain3.gain.linearRampToValueAtTime(0.6, now + 0.26);
    gain3.gain.linearRampToValueAtTime(0.2, now + 0.4);
    gain3.gain.linearRampToValueAtTime(0, now + 0.55);
    osc3.start(now + 0.25);
    osc3.stop(now + 0.55);

    // Clean up after sound completes
    setTimeout(() => {
      void audioContext.close();
    }, 700);
  } catch (error) {
    console.warn('Notification sound failed:', error);
  }
};

/**
 * Notification bell that opens a full-height drawer of notifications
 *
 * The bell keeps the badge, the chime and the background refresh of other
 * screens. The drawer holds the filterable list, shared with the
 * Notifications page.
 */
const NotificationBell = () => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const previousCountRef = useRef<number | null>(null);

  // Play sound and refresh relevant data when new notifications arrive
  const handleNewNotifications = useCallback(
    (newCount: number) => {
      const prevCount = previousCountRef.current;

      if (prevCount !== null && newCount > prevCount) {
        void playNotificationSound();

        setShowPulse(true);
        setTimeout(() => setShowPulse(false), 2000);

        void queryClient.invalidateQueries({
          queryKey: ['notifications-list'],
        });

        // Refresh the screens the new notification is likely about
        void queryClient.invalidateQueries({ queryKey: ['quotes.getMany'] });
        void queryClient.invalidateQueries({ queryKey: ['quotes.get'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        void queryClient.invalidateQueries({
          queryKey: ['privateClientOrders'],
        });
        void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
        void queryClient.invalidateQueries({
          queryKey: ['partner-dashboard'],
        });
        void queryClient.invalidateQueries({
          queryKey: ['distributor-dashboard'],
        });
      }

      previousCountRef.current = newCount;
    },
    [queryClient],
  );

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => trpcClient.notifications.getUnreadCount.query(),
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    staleTime: 5000,
  });

  useEffect(() => {
    if (unreadData?.count !== undefined) {
      handleNewNotifications(unreadData.count);
    }
  }, [unreadData?.count, handleNewNotifications]);

  const unreadCount = unreadData?.count ?? 0;
  const actionCount = unreadData?.actionCount ?? 0;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-fill-muted"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Icon icon={IconBell} size="md" colorRole="muted" />
          {unreadCount > 0 && (
            <>
              {showPulse && (
                <span className="absolute -right-0.5 -top-0.5 h-5 min-w-5 animate-ping rounded-full bg-fill-danger opacity-75" />
              )}
              <span
                className={`absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-fill-danger px-1 text-[10px] font-bold text-white ${showPulse ? 'animate-pulse' : ''}`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </>
          )}
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[460px]"
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="flex flex-col gap-0.5">
            <SheetTitle className="text-lg font-semibold text-text-primary">
              Notifications
            </SheetTitle>
            <SheetDescription className="text-xs text-text-muted">
              {actionCount > 0
                ? `${actionCount} waiting on you`
                : unreadCount > 0
                  ? `${unreadCount} unread`
                  : 'You are all caught up'}
            </SheetDescription>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/platform/settings"
              onClick={() => setIsOpen(false)}
              aria-label="Notification settings"
              title="Notification settings"
              className="flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-fill-muted hover:text-text-primary"
            >
              <Icon icon={IconSettings} size="sm" />
            </Link>
            <SheetClose
              aria-label="Close"
              className="flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-fill-muted hover:text-text-primary"
            >
              <Icon icon={IconX} size="sm" />
            </SheetClose>
          </div>
        </div>

        <NotificationFeed
          variant="drawer"
          onNavigate={() => setIsOpen(false)}
          footer={
            <Link
              href="/platform/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1 text-xs font-medium text-text-primary hover:underline"
            >
              View all notifications
              <Icon icon={IconArrowUpRight} size="xs" />
            </Link>
          }
        />
      </SheetContent>
    </Sheet>
  );
};

export default NotificationBell;
