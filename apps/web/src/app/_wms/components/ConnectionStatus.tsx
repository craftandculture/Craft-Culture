'use client';

import { IconWifi, IconWifiOff } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Connection status indicator for WMS pages.
 * Nothing while connected; a banner when the connection drops or returns.
 */
const ConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
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

  // Connected is the normal state: nothing to show. (The Local/Cloud pills
  // went with the warehouse NUC.)
  if (isOnline && !showBanner) {
    return null;
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

  // Just came back online
  if (showBanner) {
    return (
      <>
        <div className="fixed left-0 right-0 top-14 z-50 flex items-center justify-center gap-2 bg-emerald-500 px-4 py-2 text-white">
          <Icon icon={IconWifi} size="sm" className="text-white" />
          <Typography variant="bodySm" className="font-medium text-white">
            Back online — syncing changes...
          </Typography>
        </div>
      </>
    );
  }

  return null;
};

export default ConnectionStatus;
