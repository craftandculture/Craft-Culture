'use client';

import { IconPrinter, IconPrinterOff } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface ZebraPrintProps {
  /** Called when connection status changes */
  onConnectionChange?: (connected: boolean) => void;
  /** Called when print completes or fails */
  onPrintComplete?: (success: boolean, error?: string) => void;
}

export interface ZebraPrintHandle {
  /** Print ZPL to connected printer */
  print: (zpl: string) => Promise<boolean>;
  /** Check if printer is connected */
  isConnected: () => boolean;
  /** Get list of available printers */
  getPrinters: () => Promise<string[]>;
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
 * On desktop: Uses Zebra Browser Print app
 * On mobile (TC27): Uses system print dialog or downloadable ZPL
 *
 * @example
 *   const printRef = useRef<ZebraPrintHandle>(null);
 *
 *   const handlePrint = async () => {
 *     const zpl = generateLabelZpl(labelData);
 *     await printRef.current?.print(zpl);
 *   };
 *
 *   return <ZebraPrint ref={printRef} onPrintComplete={handleResult} />;
 */
const ZebraPrint = ({
  onConnectionChange,
  onPrintComplete,
}: ZebraPrintProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isEB, setIsEB] = useState(false);
  const [ebPrinterAddress, setEbPrinterAddress] = useState<string | null>(null);
  const deviceRef = useRef<unknown>(null);

  // Check if mobile/EB on mount
  useEffect(() => {
    setIsMobile(isMobileDevice());
    setIsEB(isEnterpriseBrowser());
  }, []);

  // Check for Zebra Browser Print SDK availability
  const checkConnection = useCallback(async () => {
    // Check for Enterprise Browser first
    if (isEnterpriseBrowser()) {
      const eb = getEBApi();
      if (eb?.Printer) {
        // Search for Bluetooth printers
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

    // On mobile Chrome, show manual instructions
    if (isMobileDevice()) {
      setIsConnected(false);
      setPrinterName(null);
      setError('Use Enterprise Browser for direct printing');
      onConnectionChange?.(false);
      return;
    }

    try {
      // Zebra Browser Print exposes BrowserPrint on window
      const BrowserPrint = (window as unknown as { BrowserPrint?: ZebraBrowserPrint }).BrowserPrint;

      if (!BrowserPrint) {
        setError('Zebra Browser Print not available.');
        setIsConnected(false);
        onConnectionChange?.(false);
        return;
      }

      // Get default device (usually the paired Bluetooth printer)
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

  // Check connection on mount and periodically
  useEffect(() => {
    void checkConnection();

    // Re-check every 10 seconds
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  // Print function exposed via ref
  const print = useCallback(
    async (zpl: string): Promise<boolean> => {
      // Enterprise Browser - use native Zebra API
      if (isEnterpriseBrowser() && ebPrinterAddress) {
        const eb = getEBApi();
        if (eb?.Printer) {
          return new Promise((resolve) => {
            // Connect to printer
            eb.Printer.connect(ebPrinterAddress, (connectResult) => {
              if (connectResult.status === 'connected' || connectResult.status === 'PRINTER_STATUS_SUCCESS') {
                // Send ZPL
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

      // On mobile Chrome without EB, show instructions
      if (isMobileDevice()) {
        alert(
          'For direct printing on TC27:\n\n' +
          '1. Open Enterprise Browser (EB) app\n' +
          '2. Go to warehouse.craftculture.xyz\n' +
          '3. Print from there\n\n' +
          'Enterprise Browser has direct Zebra printer support.'
        );
        onPrintComplete?.(false, 'Use Enterprise Browser for printing');
        return false;
      }

      // Desktop: use Zebra Browser Print
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

  // Expose print function globally for parent components
  useEffect(() => {
    (window as unknown as { zebraPrint?: { print: typeof print; isConnected: () => boolean } }).zebraPrint = {
      print,
      isConnected: () => isConnected,
    };

    return () => {
      delete (window as unknown as { zebraPrint?: unknown }).zebraPrint;
    };
  }, [print, isConnected]);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border-primary bg-fill-secondary px-3 py-2">
      <Icon
        icon={isConnected ? IconPrinter : IconPrinterOff}
        size="md"
        className={isConnected ? 'text-emerald-500' : isEB || isMobile ? 'text-amber-500' : 'text-red-500'}
      />
      <div className="flex flex-col">
        <Typography variant="bodyXs" className="font-medium">
          {isEB && isConnected
            ? printerName || 'EB: Printer Ready'
            : isEB
              ? 'EB: Searching...'
              : isMobile
                ? 'Use Enterprise Browser'
                : isConnected
                  ? printerName || 'Printer Connected'
                  : 'Printer Offline'}
        </Typography>
        {isMobile && !isEB && (
          <Typography variant="bodyXs" colorRole="muted">
            Open site in EB app for printing
          </Typography>
        )}
        {isEB && !isConnected && (
          <Typography variant="bodyXs" colorRole="muted">
            Pair ZD421 via Bluetooth
          </Typography>
        )}
        {!isMobile && !isEB && error && (
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
  // Check for window to avoid SSR issues
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
