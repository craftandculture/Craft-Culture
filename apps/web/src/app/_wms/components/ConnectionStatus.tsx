'use client';

import { IconServer, IconWifi, IconWifiOff } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

import { useLocalServer } from '../providers/LocalServerProvider';

/**
 * Connection status indicator for WMS pages.
 * Shows Local Mode (green), Cloud Mode (blue), or Offline (amber).
 */
const ConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const { isAvailable: isLocalAvailable } = useLocalServer();

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
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
    };
  }, []);

  // Show local mode indicator as a small pill (always visible when local)
  if (isLocalAvailable && isOnline && !showBanner) {
    return (
      <div className="fixed right-3 top-3 z-50 flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 shadow-sm">
        <Icon icon={IconServer} size="xs" className="text-white" />
        <Typography variant="bodyXs" className="font-medium text-white">
          Local
        </Typography>
      </div>
    );
  }

  // Cloud mode — don't show anything (it's the default)
  if (isOnline && !isLocalAvailable && !showBanner) {
    return null;
  }

  // Banner states
  if (!isOnline) {
    return (
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-white">
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
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 bg-emerald-500 px-4 py-2 text-white">
        <Icon icon={IconWifi} size="sm" className="text-white" />
        <Typography variant="bodySm" className="font-medium text-white">
          Back online — syncing changes...
        </Typography>
      </div>
    );
  }

  return null;
};

export default ConnectionStatus;
