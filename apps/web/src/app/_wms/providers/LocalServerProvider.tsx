'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface LocalServerContextValue {
  isAvailable: boolean;
  baseUrl: string | null;
}

const LocalServerContext = createContext<LocalServerContextValue>({
  isAvailable: false,
  baseUrl: null,
});

const HEALTH_CHECK_INTERVAL = 30_000;
const HEALTH_CHECK_TIMEOUT = 2_000;

/**
 * Provides local NUC server availability to WMS pages.
 * Pings the NUC health endpoint every 30s with a 2s timeout.
 */
const LocalServerProvider = ({ children }: React.PropsWithChildren) => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkHealth = useCallback(async () => {
    const url = process.env.NEXT_PUBLIC_WMS_LOCAL_SERVER_URL;
    if (!url) return;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

      const res = await fetch(`${url}/health`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);

      if (res.ok) {
        setIsAvailable(true);
        setBaseUrl(url);
      } else {
        setIsAvailable(false);
        setBaseUrl(null);
      }
    } catch {
      setIsAvailable(false);
      setBaseUrl(null);
    }
  }, []);

  useEffect(() => {
    // Check immediately on mount
    void checkHealth();

    // Then check every 30s
    timerRef.current = setInterval(() => {
      void checkHealth();
    }, HEALTH_CHECK_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [checkHealth]);

  return (
    <LocalServerContext.Provider value={{ isAvailable, baseUrl }}>
      {children}
    </LocalServerContext.Provider>
  );
};

/** Hook to access local NUC server availability */
const useLocalServer = () => useContext(LocalServerContext);

export default LocalServerProvider;
export { useLocalServer };
