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
  return navigator.userAgent.includes('EnterpriseBrowser');
};

/**
 * Get Enterprise Browser PrintingZebra API
 */
const getEBPrintingZebra = () => {
  if (typeof window === 'undefined') return null;
  // EB injects the API at window.EB.PrintingZebra
  const win = window as unknown as {
    EB?: {
      PrintingZebra?: {
        searchPrinters: (
          options: { connectionType: string; timeout?: number },
          callback: (printers: Array<{ connectionType: string; deviceAddress: string; deviceName: string }>) => void
        ) => void;
        connect: (
          options: { connectionType: string; deviceAddress: string },
          callback: () => void,
          errorCallback: (error: { message: string }) => void
        ) => void;
        disconnect: (callback: () => void) => void;
        printRawString: (
          zpl: string,
          options: Record<string, unknown>,
          callback: () => void,
          errorCallback: (error: { message: string }) => void
        ) => void;
      };
    };
  };
  return win.EB?.PrintingZebra || null;
};

/**
 * ZebraPrint - Component for printing to Zebra label printers
 *
 * Supports three environments:
 * 1. Desktop: Uses Zebra Browser Print app for direct printing
 * 2. Mobile: Uses file download for Printer Setup Utility
 * 3. Enterprise Browser: Uses native EB.PrintingZebra API for direct Bluetooth printing
 */
const ZebraPrint = ({
  onConnectionChange,
  onPrintComplete,
  onPrintReady,
}: ZebraPrintProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [printerAddress, setPrinterAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isEB, setIsEB] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const deviceRef = useRef<unknown>(null);

  // Search for Bluetooth printers using EB API
  const searchEBPrinters = useCallback(() => {
    const ebPrint = getEBPrintingZebra();
    if (!ebPrint) {
      setError('EB Print API not available');
      return;
    }

    setIsSearching(true);
    setError(null);

    ebPrint.searchPrinters(
      { connectionType: 'Bluetooth', timeout: 10000 },
      (printers) => {
        setIsSearching(false);
        if (printers && printers.length > 0) {
          const printer = printers[0];
          setPrinterName(printer.deviceName || 'Zebra Printer');
          setPrinterAddress(printer.deviceAddress);
          setIsConnected(true);
          setError(null);
          onConnectionChange?.(true);
        } else {
          setError('No printer found. Pair ZD421 first.');
          setIsConnected(false);
          onConnectionChange?.(false);
        }
      }
    );
  }, [onConnectionChange]);

  // Check environment on mount
  useEffect(() => {
    const mobile = isMobileDevice();
    const eb = isEnterpriseBrowser();
    setIsMobile(mobile);
    setIsEB(eb);

    if (eb) {
      // In Enterprise Browser, search for printers
      // Small delay to let EB API initialize
      const timer = setTimeout(() => {
        searchEBPrinters();
      }, 1000);
      return () => clearTimeout(timer);
    } else if (mobile) {
      // Mobile uses download - always "ready"
      setIsConnected(true);
      onConnectionChange?.(true);
    }
    return undefined;
  }, [onConnectionChange, searchEBPrinters]);

  // Check for Zebra Browser Print SDK availability (desktop only)
  const checkDesktopConnection = useCallback(async () => {
    if (isMobileDevice() || isEnterpriseBrowser()) {
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
            setError('No printer found.');
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

  // Check desktop connection on mount (not mobile/EB)
  useEffect(() => {
    if (!isMobileDevice() && !isEnterpriseBrowser()) {
      void checkDesktopConnection();
      const interval = setInterval(checkDesktopConnection, 10000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [checkDesktopConnection]);

  /**
   * Print ZPL to Zebra printer
   */
  const print = useCallback(
    async (zpl: string): Promise<boolean> => {
      // Enterprise Browser - use native PrintingZebra API
      if (isEnterpriseBrowser()) {
        const ebPrint = getEBPrintingZebra();
        if (!ebPrint || !printerAddress) {
          onPrintComplete?.(false, 'Printer not connected');
          return false;
        }

        return new Promise((resolve) => {
          // Connect, print, disconnect
          ebPrint.connect(
            { connectionType: 'Bluetooth', deviceAddress: printerAddress },
            () => {
              // Connected - now print
              ebPrint.printRawString(
                zpl,
                {},
                () => {
                  // Print success - disconnect
                  ebPrint.disconnect(() => {
                    onPrintComplete?.(true);
                    resolve(true);
                  });
                },
                (printError) => {
                  ebPrint.disconnect(() => {
                    onPrintComplete?.(false, printError.message);
                    resolve(false);
                  });
                }
              );
            },
            (connectError) => {
              onPrintComplete?.(false, `Connect failed: ${connectError.message}`);
              resolve(false);
            }
          );
        });
      }

      // Mobile - use server-side download endpoint
      if (isMobileDevice()) {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const deviceToken = urlParams.get('device_token') || '';
          const zplBase64 = btoa(zpl);
          const downloadUrl = `/api/wms/print?device_token=${encodeURIComponent(deviceToken)}&zpl=${encodeURIComponent(zplBase64)}`;
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = `labels-${Date.now()}.zpl`;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          onPrintComplete?.(true);
          return true;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Print failed';
          onPrintComplete?.(false, message);
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
    [onPrintComplete, printerAddress],
  );

  // Expose print function globally and via callback
  useEffect(() => {
    (window as unknown as { zebraPrint?: { print: typeof print; isConnected: () => boolean } }).zebraPrint = {
      print,
      isConnected: () => isConnected,
    };
    onPrintReady?.(print);
    return () => {
      delete (window as unknown as { zebraPrint?: unknown }).zebraPrint;
    };
  }, [print, isConnected, onPrintReady]);

  // Enterprise Browser view
  if (isEB) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border-primary bg-fill-secondary px-3 py-2">
        <Icon
          icon={isConnected ? IconPrinter : IconPrinterOff}
          size="md"
          className={isConnected ? 'text-emerald-500' : isSearching ? 'text-amber-500' : 'text-red-500'}
        />
        <div className="flex flex-col">
          <Typography variant="bodyXs" className="font-medium">
            {isSearching
              ? 'Searching...'
              : isConnected
                ? printerName || 'Printer Ready'
                : 'No Printer'}
          </Typography>
          {!isConnected && !isSearching && (
            <button
              onClick={searchEBPrinters}
              className="text-left text-xs text-blue-500 underline"
            >
              Search Again
            </button>
          )}
          {error && (
            <Typography variant="bodyXs" colorRole="muted" className="text-red-500">
              {error}
            </Typography>
          )}
        </div>
      </div>
    );
  }

  // Mobile view
  if (isMobile) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border-primary bg-fill-secondary px-3 py-2">
        <Icon icon={IconShare} size="md" className="text-blue-500" />
        <div className="flex flex-col">
          <Typography variant="bodyXs" className="font-medium">
            Download to Print
          </Typography>
        </div>
      </div>
    );
  }

  // Desktop view
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border-primary bg-fill-secondary px-3 py-2">
      <Icon
        icon={isConnected ? IconPrinter : IconPrinterOff}
        size="md"
        className={isConnected ? 'text-emerald-500' : 'text-red-500'}
      />
      <div className="flex flex-col">
        <Typography variant="bodyXs" className="font-medium">
          {isConnected ? printerName || 'Printer Connected' : 'Printer Offline'}
        </Typography>
        {error && (
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
