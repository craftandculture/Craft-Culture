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
  // Check user agent for Enterprise Browser
  return navigator.userAgent.includes('EnterpriseBrowser');
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
  const deviceRef = useRef<unknown>(null);

  // Check environment on mount
  useEffect(() => {
    const mobile = isMobileDevice();
    const eb = isEnterpriseBrowser();
    setIsMobile(mobile);
    setIsEB(eb);

    // Mobile and EB are always "ready" - they use download/share for printing
    if (mobile || eb) {
      setIsConnected(true);
      onConnectionChange?.(true);
    }
  }, [onConnectionChange]);

  // Check for Zebra Browser Print SDK availability (desktop only)
  const checkDesktopConnection = useCallback(async () => {
    // Skip on mobile and Enterprise Browser - they use download/share
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
   * - On Enterprise Browser: Downloads ZPL file for Printer Setup Utility
   * - On mobile: Opens share sheet for Printer Setup Utility
   * - On desktop: Sends directly via Browser Print SDK
   */
  const print = useCallback(
    async (zpl: string): Promise<boolean> => {
      // Enterprise Browser / Mobile - use server-side download endpoint
      // This bypasses JavaScript issues and uses standard HTTP which EB handles reliably
      if (isEnterpriseBrowser() || isMobileDevice()) {
        try {
          // Get device token from URL
          const urlParams = new URLSearchParams(window.location.search);
          const deviceToken = urlParams.get('device_token') || '';

          // Encode ZPL as base64 for URL safety
          const zplBase64 = btoa(zpl);

          // Create link to download endpoint
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
    [onPrintComplete],
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

  // Enterprise Browser view - download to print
  if (isEB) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border-primary bg-fill-secondary px-3 py-2">
        <Icon
          icon={IconPrinter}
          size="md"
          className="text-emerald-500"
        />
        <div className="flex flex-col">
          <Typography variant="bodyXs" className="font-medium">
            Ready to Print
          </Typography>
        </div>
      </div>
    );
  }

  // Mobile view - share to print
  if (isMobile) {
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
