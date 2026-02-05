'use client';

import { IconBluetooth, IconPrinter, IconPrinterOff } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
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

// Zebra BLE Print Service UUIDs
const ZEBRA_PRINT_SERVICE = '38eb4a80-c570-11e3-9507-0002a5d5c51b';
const ZEBRA_WRITE_CHARACTERISTIC = '38eb4a82-c570-11e3-9507-0002a5d5c51b';

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
 * Check if Web Bluetooth is available
 */
const hasWebBluetooth = () => {
  if (typeof window === 'undefined') return false;
  return 'bluetooth' in navigator;
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
 * On mobile: Uses Web Bluetooth for direct printing (tap button → instant print)
 * On desktop: Uses Zebra Browser Print app
 * On Enterprise Browser: Uses native Zebra API
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
  const [hasBluetooth, setHasBluetooth] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [ebPrinterAddress, setEbPrinterAddress] = useState<string | null>(null);

  // Refs for BLE connection
  const bleDeviceRef = useRef<BluetoothDevice | null>(null);
  const bleCharacteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const deviceRef = useRef<unknown>(null);

  // Check environment on mount
  useEffect(() => {
    setIsMobile(isMobileDevice());
    setIsEB(isEnterpriseBrowser());
    setHasBluetooth(hasWebBluetooth());
  }, []);

  /**
   * Connect to Zebra printer via Web Bluetooth
   */
  const connectBluetooth = useCallback(async () => {
    if (!hasWebBluetooth()) {
      setError('Web Bluetooth not supported');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request device with Zebra Print Service
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [ZEBRA_PRINT_SERVICE] },
          { namePrefix: 'ZD421' },
          { namePrefix: 'Zebra' },
        ],
        optionalServices: [ZEBRA_PRINT_SERVICE],
      });

      if (!device.gatt) {
        throw new Error('Bluetooth GATT not available');
      }

      // Handle disconnection
      device.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
        setPrinterName(null);
        bleCharacteristicRef.current = null;
        onConnectionChange?.(false);
      });

      // Connect to GATT server
      const server = await device.gatt.connect();

      // Get print service
      const service = await server.getPrimaryService(ZEBRA_PRINT_SERVICE);

      // Get write characteristic
      const characteristic = await service.getCharacteristic(ZEBRA_WRITE_CHARACTERISTIC);

      // Store references
      bleDeviceRef.current = device;
      bleCharacteristicRef.current = characteristic;

      setIsConnected(true);
      setPrinterName(device.name || 'Zebra Printer');
      setError(null);
      onConnectionChange?.(true);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      // Don't show error if user cancelled the picker
      if (!message.includes('cancelled') && !message.includes('canceled')) {
        setError(message);
      }
      setIsConnected(false);
      onConnectionChange?.(false);
    } finally {
      setIsConnecting(false);
    }
  }, [onConnectionChange]);

  // Check for Zebra Browser Print SDK availability (desktop)
  const checkDesktopConnection = useCallback(async () => {
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

    // Skip desktop check on mobile
    if (isMobileDevice()) {
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
   * Send data via Web Bluetooth (chunked for large payloads)
   */
  const sendViaBluetooth = useCallback(async (zpl: string): Promise<boolean> => {
    const characteristic = bleCharacteristicRef.current;

    if (!characteristic) {
      onPrintComplete?.(false, 'Printer not connected');
      return false;
    }

    try {
      // Encode ZPL to bytes
      const encoder = new TextEncoder();
      const data = encoder.encode(zpl);

      // BLE has MTU limits, send in chunks (typically 512 bytes is safe)
      const chunkSize = 512;

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await characteristic.writeValueWithoutResponse(chunk);
      }

      onPrintComplete?.(true);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Print failed';
      onPrintComplete?.(false, message);

      // If write failed, connection may be lost
      if (message.includes('GATT') || message.includes('disconnected')) {
        setIsConnected(false);
        bleCharacteristicRef.current = null;
        onConnectionChange?.(false);
      }

      return false;
    }
  }, [onPrintComplete, onConnectionChange]);

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

      // Mobile with Web Bluetooth - instant printing
      if (isMobileDevice() && bleCharacteristicRef.current) {
        return sendViaBluetooth(zpl);
      }

      // Mobile without connection - prompt to connect
      if (isMobileDevice() && !bleCharacteristicRef.current) {
        onPrintComplete?.(false, 'Tap "Connect Printer" first');
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
    [onPrintComplete, ebPrinterAddress, sendViaBluetooth],
  );

  // Expose print function globally for parent components
  useEffect(() => {
    (window as unknown as { zebraPrint?: { print: typeof print; isConnected: () => boolean; connect: () => Promise<void> } }).zebraPrint = {
      print,
      isConnected: () => isConnected,
      connect: connectBluetooth,
    };

    return () => {
      delete (window as unknown as { zebraPrint?: unknown }).zebraPrint;
    };
  }, [print, isConnected, connectBluetooth]);

  // Mobile view with Web Bluetooth
  if (isMobile && !isEB) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border-primary bg-fill-secondary px-3 py-2">
        {isConnected ? (
          <>
            <Icon
              icon={IconPrinter}
              size="md"
              className="text-emerald-500"
            />
            <div className="flex flex-col">
              <Typography variant="bodyXs" className="font-medium">
                {printerName || 'Printer Connected'}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Ready for instant printing
              </Typography>
            </div>
          </>
        ) : hasBluetooth ? (
          <>
            <Button
              variant="primary"
              size="sm"
              onClick={connectBluetooth}
              disabled={isConnecting}
            >
              <div className="flex items-center gap-2">
                <IconBluetooth className="h-4 w-4" />
                {isConnecting ? 'Connecting...' : 'Connect Printer'}
              </div>
            </Button>
            {error && (
              <Typography variant="bodyXs" className="text-red-500">
                {error}
              </Typography>
            )}
          </>
        ) : (
          <>
            <Icon
              icon={IconPrinterOff}
              size="md"
              className="text-red-500"
            />
            <div className="flex flex-col">
              <Typography variant="bodyXs" className="font-medium">
                Bluetooth Not Available
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Use Chrome browser for printing
              </Typography>
            </div>
          </>
        )}
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
 *   const { print, isConnected, connect } = useZebraPrint();
 *   await connect(); // One-time per session
 *   await print(zplCode); // Instant print
 */
export const useZebraPrint = () => {
  // Check for window to avoid SSR issues
  if (typeof window === 'undefined') {
    return {
      print: async () => false,
      isConnected: () => false,
      connect: async () => {},
    };
  }

  const zebraPrint = (window as unknown as { zebraPrint?: { print: (zpl: string) => Promise<boolean>; isConnected: () => boolean; connect: () => Promise<void> } }).zebraPrint;

  return {
    print: zebraPrint?.print ?? (async () => false),
    isConnected: zebraPrint?.isConnected ?? (() => false),
    connect: zebraPrint?.connect ?? (async () => {}),
  };
};
