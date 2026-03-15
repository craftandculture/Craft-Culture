'use client';

import { IconCloud, IconServer, IconWifi, IconWifiOff } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

import { useLocalServer } from '../providers/LocalServerProvider';

/**
 * Connection status indicator for WMS pages.
 * Shows Local Mode (green), Cloud Mode (amber), or Offline (red banner).
 */
const ConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const { isAvailable: isLocalAvailable } = useLocalServer();
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  // Show local mode indicator as a small pill (always visible when local server is connected)
  const localPill = isLocalAvailable && isOnline ? (
    <div className="fixed right-4 top-16 z-40 flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 shadow-sm">
      <Icon icon={IconServer} size="xs" className="text-white" />
      <Typography variant="bodyXs" className="font-medium text-white">
        Local
      </Typography>
    </div>
  ) : null;

  // Cloud-only pill (no NUC available but online)
  const cloudPill = !isLocalAvailable && isOnline ? (
    <div className="fixed right-4 top-16 z-40 flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 shadow-sm">
      <Icon icon={IconCloud} size="xs" className="text-white" />
      <Typography variant="bodyXs" className="font-medium text-white">
        Cloud
      </Typography>
    </div>
  ) : null;

  // Cloud mode — show appropriate pill
  if (isOnline && !showBanner) {
    return localPill ?? cloudPill;
  }

  // Banner states
  if (!isOnline) {
    return (
      <div className="fixed left-0 right-0 top-14 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-white">
        <Icon icon={IconWifiOff} size="sm" className="text-white" />
        <Typography variant="bodySm" className="font-medium text-white">
          Offline — Changes will sync when connection returns
        </Typography>
      </div>
    );
  }

  // Just came back online — show banner + keep pill visible
  if (showBanner) {
    return (
      <>
        <div className="fixed left-0 right-0 top-14 z-50 flex items-center justify-center gap-2 bg-emerald-500 px-4 py-2 text-white">
          <Icon icon={IconWifi} size="sm" className="text-white" />
          <Typography variant="bodySm" className="font-medium text-white">
            Back online — syncing changes...
          </Typography>
        </div>
        {localPill ?? cloudPill}
      </>
    );
  }

  return localPill ?? cloudPill;
};

export default ConnectionStatus;
