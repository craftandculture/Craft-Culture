'use client';

import { createContext, useContext } from 'react';

interface LocalServerContextValue {
  isAvailable: boolean;
  baseUrl: string | null;
}

/*
  The warehouse NUC is retired (27 Oct 2026). Scanners used it as a local
  server when it answered and fell back to the cloud when it did not, so the
  same pick or receive could run on either side: it bypassed the cloud's
  double-pick and double-receive guards, had no login, and its outages were a
  source of chaos. Every scanner action now goes to the cloud. Labels are
  unaffected: they print straight to the Zebra printers over WiFi.
*/
const RETIRED: LocalServerContextValue = { isAvailable: false, baseUrl: null };

const LocalServerContext = createContext<LocalServerContextValue>(RETIRED);

/** Keeps the WMS pages' local-server context; it always reports unavailable */
const LocalServerProvider = ({ children }: React.PropsWithChildren) => (
  <LocalServerContext.Provider value={RETIRED}>{children}</LocalServerContext.Provider>
);

/** Hook to access local NUC server availability (always unavailable) */
const useLocalServer = () => useContext(LocalServerContext);

export default LocalServerProvider;
export { useLocalServer };
