'use client';

import { useCallback } from 'react';


import type { LabelSize } from '../providers/PrinterProvider';
import { usePrinterContext } from '../providers/PrinterProvider';
import wifiPrint from '../utils/wifiPrint';

/**
 * Hook for printing ZPL to the correct printer based on label size.
 *
 * Routes to the first online, enabled printer matching the requested label size.
 * Falls over to backup printers automatically if the primary is unreachable.
 *
 * @example
 *   const { print } = usePrint();
 *   await print(zpl, '4x2'); // case/location labels
 *   await print(zpl, '4x6'); // bay totems, pallet labels
 */
const usePrint = () => {
  const { printers, printerStatus } = usePrinterContext();

  const print = useCallback(
    async (zpl: string, labelSize: LabelSize): Promise<boolean> => {
      // Filter to enabled printers matching the requested label size
      const candidates = printers
        .filter((p) => p.labelSize === labelSize && p.enabled)
        .sort((a, b) => {
          // Prefer printers known to be online
          const aOnline = printerStatus[a.id] ? 1 : 0;
          const bOnline = printerStatus[b.id] ? 1 : 0;
          return bOnline - aOnline;
        });

      // Try each candidate until one succeeds (failover)
      for (const printer of candidates) {
        const success = await wifiPrint(zpl, printer.ip);
        if (success) return true;
      }

      // No configured printers for this size — fall back to env var default
      if (candidates.length === 0) {
        return wifiPrint(zpl);
      }

      return false;
    },
    [printers, printerStatus],
  );

  return { print };
};

export default usePrint;
