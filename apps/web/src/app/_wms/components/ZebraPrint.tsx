'use client';

import { IconPrinter, IconPrinterOff, IconShare } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface ZebraPrintProps {
  /** Called when connection status changes */
  onConnectionChange?: (connected: boolean) => void;
  /** Called when print completes or fails */
  onPrintComplete?: (success: boolean, error?: string) => void;
  /** Called when print function is ready - use this instead of useZebraPrint hook */
  onPrintReady?: (printFn: (zpl: string) => Promise<boolean>) => void;
}

export interface ZebraPrintHandle {
  /** Print ZPL to connected printer */
  print: (zpl: string) => Promise<boolean>;
  /** Check if printer is connected */
  isConnected: () => boolean;
}

/**
 * Detect if running on a mobile device
 */
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * Detect if running in Zebra Enterprise Browser
 */
const isEnterpriseBrowser = () => {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as { EB?: unknown }).EB ||
    !!(window as unknown as { Zebra?: unknown }).Zebra ||
    navigator.userAgent.includes('EnterpriseBrowser');
};

/**
 * Zebra Enterprise Browser API types
 */
interface ZebraEBPrinter {
  connect: (mac: string, callback: (result: { status: string }) => void) => void;
  disconnect: (callback: () => void) => void;
  send: (data: string, callback: (result: { status: string }) => void) => void;
  searchPrinters: (options: { connectionType: string }, callback: (printers: Array<{ address: string; friendlyName: string }>) => void) => void;
}

interface ZebraEB {
  Printer: ZebraEBPrinter;
}

/**
 * Get Zebra Enterprise Browser API
 */
const getEBApi = (): ZebraEB | null => {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { EB?: ZebraEB }).EB ||
    (window as unknown as { Zebra?: ZebraEB }).Zebra ||
    null;
};

/**
 * ZebraPrint - Component for printing to Zebra label printers
 *
 * Supports three environments:
 * 1. Desktop: Uses Zebra Browser Print app for direct printing
 * 2. Mobile (TC27/Android): Uses Web Share API to send ZPL to Printer Setup Utility
 * 3. Enterprise Browser: Uses native Zebra API for direct Bluetooth printing
 *
 * Mobile workflow:
 * - Print button triggers share sheet
 * - User selects "Printer Setup Utility"
 * - Label prints immediately
 *
 * @example
 *   <ZebraPrint onPrintComplete={(success) => console.log(success)} />
 *
 *   // From anywhere in the app:
 *   const { print } = useZebraPrint();
 *   await print(zplCode);
 */
const ZebraPrint = ({
  onConnectionChange,
  onPrintComplete,
  onPrintReady,
}: ZebraPrintProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isEB, setIsEB] = useState(false);
  const [ebPrinterAddress, setEbPrinterAddress] = useState<string | null>(null);
  const deviceRef = useRef<unknown>(null);

  // Check environment on mount
  useEffect(() => {
    const mobile = isMobileDevice();
    const eb = isEnterpriseBrowser();
    setIsMobile(mobile);
    setIsEB(eb);

    // Mobile is always "ready" via Web Share API - no connection needed
    if (mobile && !eb) {
      onConnectionChange?.(true);
    }
  }, [onConnectionChange]);

  // Check for Zebra Browser Print SDK availability (desktop only)
  const checkDesktopConnection = useCallback(async () => {
    // Check for Enterprise Browser first
    if (isEnterpriseBrowser()) {
      const eb = getEBApi();
      if (eb?.Printer) {
        eb.Printer.searchPrinters({ connectionType: 'bluetooth' }, (printers) => {
          if (printers && printers.length > 0) {
            const printer = printers[0];
            setEbPrinterAddress(printer.address);
            setPrinterName(printer.friendlyName || 'Zebra Printer');
            setIsConnected(true);
            setError(null);
            onConnectionChange?.(true);
          } else {
            setError('No Bluetooth printer found. Pair ZD421 first.');
            setIsConnected(false);
            onConnectionChange?.(false);
          }
        });
        return;
      }
    }

    // Skip desktop check on mobile - mobile uses share API
    if (isMobileDevice()) {
      return;
    }

    try {
      const BrowserPrint = (window as unknown as { BrowserPrint?: ZebraBrowserPrint }).BrowserPrint;

      if (!BrowserPrint) {
        setError('Zebra Browser Print not available.');
        setIsConnected(false);
        onConnectionChange?.(false);
        return;
      }

      BrowserPrint.getDefaultDevice(
        'printer',
        (device: ZebraDevice) => {
          if (device) {
            deviceRef.current = device;
            setPrinterName(device.name || 'Zebra Printer');
            setIsConnected(true);
            setError(null);
            onConnectionChange?.(true);
          } else {
            setError('No printer found. Ensure printer is paired via Bluetooth.');
            setIsConnected(false);
            onConnectionChange?.(false);
          }
        },
        (err: string) => {
          setError(`Connection error: ${err}`);
          setIsConnected(false);
          onConnectionChange?.(false);
        },
      );
    } catch {
      setError('Failed to connect to Zebra Browser Print');
      setIsConnected(false);
      onConnectionChange?.(false);
    }
  }, [onConnectionChange]);

  // Check desktop connection on mount (not mobile)
  useEffect(() => {
    if (!isMobileDevice()) {
      void checkDesktopConnection();
      const interval = setInterval(checkDesktopConnection, 10000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [checkDesktopConnection]);

  /**
   * Print ZPL to Zebra printer
   *
   * - On mobile: Opens share sheet for Printer Setup Utility
   * - On desktop: Sends directly via Browser Print SDK
   * - On Enterprise Browser: Uses native Zebra API
   */
  const print = useCallback(
    async (zpl: string): Promise<boolean> => {
      // Enterprise Browser - use native Zebra API
      if (isEnterpriseBrowser() && ebPrinterAddress) {
        const eb = getEBApi();
        if (eb?.Printer) {
          return new Promise((resolve) => {
            eb.Printer.connect(ebPrinterAddress, (connectResult) => {
              if (connectResult.status === 'connected' || connectResult.status === 'PRINTER_STATUS_SUCCESS') {
                eb.Printer.send(zpl, (sendResult) => {
                  eb.Printer.disconnect(() => {
                    if (sendResult.status === 'sent' || sendResult.status === 'PRINTER_STATUS_SUCCESS') {
                      onPrintComplete?.(true);
                      resolve(true);
                    } else {
                      onPrintComplete?.(false, `Print failed: ${sendResult.status}`);
                      resolve(false);
                    }
                  });
                });
              } else {
                onPrintComplete?.(false, `Connect failed: ${connectResult.status}`);
                resolve(false);
              }
            });
          });
        }
      }

      // Mobile - use Web Share API for Printer Setup Utility
      if (isMobileDevice()) {
        try {
          const file = new File([zpl], `label-${Date.now()}.zpl`, { type: 'application/octet-stream' });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Print Label',
            });
            onPrintComplete?.(true);
            return true;
          }

          // Fallback: download file
          const blob = new Blob([zpl], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `label-${Date.now()}.zpl`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          onPrintComplete?.(true);
          return true;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Share failed';
          if (!message.includes('abort') && !message.includes('cancel')) {
            onPrintComplete?.(false, message);
          }
          return false;
        }
      }

      // Desktop: use Zebra Browser Print SDK
      const device = deviceRef.current as ZebraDevice | null;

      if (!device) {
        onPrintComplete?.(false, 'No printer connected');
        return false;
      }

      return new Promise((resolve) => {
        device.send(
          zpl,
          () => {
            onPrintComplete?.(true);
            resolve(true);
          },
          (err: string) => {
            onPrintComplete?.(false, err);
            resolve(false);
          },
        );
      });
    },
    [onPrintComplete, ebPrinterAddress],
  );

  // Expose print function globally and via callback
  useEffect(() => {
    (window as unknown as { zebraPrint?: { print: typeof print; isConnected: () => boolean } }).zebraPrint = {
      print,
      isConnected: () => isConnected || isMobileDevice(), // Mobile always "ready" via share
    };

    // Notify parent that print function is ready
    onPrintReady?.(print);

    return () => {
      delete (window as unknown as { zebraPrint?: unknown }).zebraPrint;
    };
  }, [print, isConnected, onPrintReady]);

  // Mobile view - always ready via share
  if (isMobile && !isEB) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border-primary bg-fill-secondary px-3 py-2">
        <Icon
          icon={IconShare}
          size="md"
          className="text-blue-500"
        />
        <div className="flex flex-col">
          <Typography variant="bodyXs" className="font-medium">
            Share to Print
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Select Printer Setup Utility
          </Typography>
        </div>
      </div>
    );
  }

  // Desktop/EB view
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border-primary bg-fill-secondary px-3 py-2">
      <Icon
        icon={isConnected ? IconPrinter : IconPrinterOff}
        size="md"
        className={isConnected ? 'text-emerald-500' : isEB ? 'text-amber-500' : 'text-red-500'}
      />
      <div className="flex flex-col">
        <Typography variant="bodyXs" className="font-medium">
          {isEB && isConnected
            ? printerName || 'EB: Printer Ready'
            : isEB
              ? 'EB: Searching...'
              : isConnected
                ? printerName || 'Printer Connected'
                : 'Printer Offline'}
        </Typography>
        {isEB && !isConnected && (
          <Typography variant="bodyXs" colorRole="muted">
            Pair ZD421 via Bluetooth
          </Typography>
        )}
        {!isEB && error && (
          <Typography variant="bodyXs" colorRole="muted" className="text-red-500">
            {error}
          </Typography>
        )}
      </div>
    </div>
  );
};

// Type definitions for Zebra Browser Print SDK
interface ZebraDevice {
  name?: string;
  send: (data: string, onSuccess: () => void, onError: (err: string) => void) => void;
}

interface ZebraBrowserPrint {
  getDefaultDevice: (
    type: string,
    onSuccess: (device: ZebraDevice) => void,
    onError: (err: string) => void,
  ) => void;
  getLocalDevices: (
    onSuccess: (devices: ZebraDevice[]) => void,
    onError: (err: string) => void,
  ) => void;
}

export default ZebraPrint;

/**
 * Hook to access the ZebraPrint functions from anywhere
 *
 * @example
 *   const { print, isConnected } = useZebraPrint();
 *   await print(zplCode);
 */
export const useZebraPrint = () => {
  if (typeof window === 'undefined') {
    return {
      print: async () => false,
      isConnected: () => false,
    };
  }

  const zebraPrint = (window as unknown as { zebraPrint?: { print: (zpl: string) => Promise<boolean>; isConnected: () => boolean } }).zebraPrint;

  return {
    print: zebraPrint?.print ?? (async () => false),
    isConnected: zebraPrint?.isConnected ?? (() => false),
  };
};
