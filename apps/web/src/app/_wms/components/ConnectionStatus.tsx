'use client';

import { IconWifi, IconWifiOff } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Connection status indicator for WMS pages
 * Shows online/offline status and warns users when working offline
 */
const ConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Initialize with current status
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Show brief reconnection message
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

  // Don't show anything if online and not showing banner
  if (isOnline && !showBanner) {
    return null;
  }

  return (
    <div
      className={`fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 transition-colors ${
        isOnline
          ? 'bg-emerald-500 text-white'
          : 'bg-amber-500 text-white'
      }`}
    >
      <Icon
        icon={isOnline ? IconWifi : IconWifiOff}
        size="sm"
        className="text-white"
      />
      <Typography variant="bodySm" className="font-medium text-white">
        {isOnline
          ? 'Back online - syncing changes...'
          : 'Offline - Changes will sync when connection returns'}
      </Typography>
    </div>
  );
};

export default ConnectionStatus;
