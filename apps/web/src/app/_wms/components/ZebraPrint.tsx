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
  const deviceRef = useRef<unknown>(null);

  // Check if mobile on mount
  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  // Check for Zebra Browser Print SDK availability
  const checkConnection = useCallback(async () => {
    // On mobile, we use a different print mechanism
    if (isMobileDevice()) {
      // Mobile devices use system print or ZPL download
      // Mark as "connected" since we can always generate ZPL
      setIsConnected(true);
      setPrinterName('Mobile Print (System)');
      setError(null);
      onConnectionChange?.(true);
      return;
    }

    try {
      // Zebra Browser Print exposes BrowserPrint on window
      const BrowserPrint = (window as unknown as { BrowserPrint?: ZebraBrowserPrint }).BrowserPrint;

      if (!BrowserPrint) {
        setError('Zebra Browser Print not available. Use Browser Print button for mobile.');
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
      // On mobile, try multiple approaches
      if (isMobileDevice()) {
        try {
          // Try Web Share API first (works well on Android)
          if (navigator.share && navigator.canShare) {
            const file = new File([zpl], 'label.zpl', { type: 'application/octet-stream' });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: 'Print Label',
                text: 'Open with PrintConnect to print',
              });
              onPrintComplete?.(true);
              return true;
            }
          }

          // Fallback: Create blob URL and try to open PrintConnect via intent
          const blob = new Blob([zpl], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);

          // Try opening with intent (Android)
          const intentUrl = `intent://${url.replace('blob:', '')}#Intent;scheme=file;type=application/octet-stream;package=com.zebra.printconnect;end`;

          // Create hidden iframe to try intent
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = intentUrl;
          document.body.appendChild(iframe);

          // Also create download link as fallback
          setTimeout(() => {
            document.body.removeChild(iframe);
            const link = document.createElement('a');
            link.href = url;
            link.download = `label-${Date.now()}.zpl`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }, 1000);

          onPrintComplete?.(true);
          return true;
        } catch {
          // Final fallback: just download
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
        }
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
    [onPrintComplete],
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
        className={isConnected ? 'text-emerald-500' : 'text-red-500'}
      />
      <div className="flex flex-col">
        <Typography variant="bodyXs" className="font-medium">
          {isMobile
            ? 'Mobile Print Ready'
            : isConnected
              ? printerName || 'Printer Connected'
              : 'Printer Offline'}
        </Typography>
        {isMobile && (
          <Typography variant="bodyXs" colorRole="muted">
            Downloads ZPL for PrintConnect
          </Typography>
        )}
        {!isMobile && error && (
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
