'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/** Label size supported by the WMS printing system */
type LabelSize = '4x2' | '4x6';

/** Configuration for a single network printer */
interface PrinterConfig {
  id: string;
  name: string;
  ip: string;
  labelSize: LabelSize;
  enabled: boolean;
}

interface PrinterContextValue {
  printers: PrinterConfig[];
  printerStatus: Record<string, boolean>;
  addPrinter: (printer: Omit<PrinterConfig, 'id'>) => void;
  removePrinter: (id: string) => void;
  updatePrinter: (id: string, updates: Partial<Omit<PrinterConfig, 'id'>>) => void;
}

const PrinterContext = createContext<PrinterContextValue>({
  printers: [],
  printerStatus: {},
  addPrinter: () => {},
  removePrinter: () => {},
  updatePrinter: () => {},
});

const STORAGE_KEY = 'wms-printers';
const HEALTH_CHECK_INTERVAL = 15_000;
const HEALTH_CHECK_TIMEOUT = 3_000;

/**
 * Load printers from localStorage, returning empty array if not found or invalid.
 */
const loadPrinters = (): PrinterConfig[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PrinterConfig[];
  } catch {
    return [];
  }
};

/**
 * Save printers to localStorage.
 */
const savePrinters = (printers: PrinterConfig[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(printers));
};

/**
 * Check if a printer is reachable by hitting its web server.
 * Uses no-cors mode since printers don't set CORS headers.
 */
const checkPrinter = async (ip: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);
    await fetch(`http://${ip}/`, {
      mode: 'no-cors',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
};

/**
 * Provides multi-printer management to WMS pages.
 * Stores printer configs in localStorage, health-checks each every 15s.
 */
const PrinterProvider = ({ children }: React.PropsWithChildren) => {
  const [printers, setPrinters] = useState<PrinterConfig[]>(loadPrinters);
  const [printerStatus, setPrinterStatus] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist to localStorage whenever printers change
  useEffect(() => {
    savePrinters(printers);
  }, [printers]);

  const addPrinter = useCallback((printer: Omit<PrinterConfig, 'id'>) => {
    const newPrinter: PrinterConfig = {
      ...printer,
      id: crypto.randomUUID(),
    };
    setPrinters((prev) => [...prev, newPrinter]);
  }, []);

  const removePrinter = useCallback((id: string) => {
    setPrinters((prev) => prev.filter((p) => p.id !== id));
    setPrinterStatus((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const updatePrinter = useCallback((id: string, updates: Partial<Omit<PrinterConfig, 'id'>>) => {
    setPrinters((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  // Health check all enabled printers periodically
  const checkAllPrinters = useCallback(async () => {
    const enabled = printers.filter((p) => p.enabled);
    if (enabled.length === 0) return;

    const results = await Promise.all(
      enabled.map(async (p) => ({
        id: p.id,
        online: await checkPrinter(p.ip),
      })),
    );

    setPrinterStatus((prev) => {
      const next = { ...prev };
      for (const r of results) {
        next[r.id] = r.online;
      }
      return next;
    });
  }, [printers]);

  useEffect(() => {
    void checkAllPrinters();

    timerRef.current = setInterval(() => {
      void checkAllPrinters();
    }, HEALTH_CHECK_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [checkAllPrinters]);

  return (
    <PrinterContext.Provider
      value={{ printers, printerStatus, addPrinter, removePrinter, updatePrinter }}
    >
      {children}
    </PrinterContext.Provider>
  );
};

/** Hook to access printer management context */
const usePrinterContext = () => useContext(PrinterContext);

export default PrinterProvider;
export { usePrinterContext };
export type { LabelSize, PrinterConfig };
