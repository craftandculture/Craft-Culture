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
 * ZebraPrint - Component for printing to Zebra label printers via Zebra Browser Print
 *
 * Connects to Zebra Browser Print app running on TC27 scanner.
 * The app creates a local WebSocket connection to Bluetooth-paired printers.
 *
 * Setup required:
 * 1. Install "Zebra Browser Print" app on TC27 from Play Store
 * 2. Pair ZD421 printer to TC27 via Bluetooth
 * 3. Open app and ensure printer is connected
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
  const deviceRef = useRef<unknown>(null);

  // Check for Zebra Browser Print SDK availability
  const checkConnection = useCallback(async () => {
    try {
      // Zebra Browser Print exposes BrowserPrint on window
      const BrowserPrint = (window as unknown as { BrowserPrint?: ZebraBrowserPrint }).BrowserPrint;

      if (!BrowserPrint) {
        setError('Zebra Browser Print not available. Install the app on your device.');
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
