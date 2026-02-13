'use client';

import { IconPrinter, IconPrinterOff, IconWifi } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface ZebraPrintProps {
  onConnectionChange?: (connected: boolean) => void;
  onPrintComplete?: (success: boolean, error?: string) => void;
  onPrintReady?: (printFn: (zpl: string) => Promise<boolean>) => void;
}

// Zebra BLE Service UUIDs
const ZEBRA_PARSER_SERVICE = '38eb4a80-c570-11e3-9507-0002a5d5c51b';
const ZEBRA_WRITE_CHARACTERISTIC = '38eb4a82-c570-11e3-9507-0002a5d5c51b';

/**
 * Printer IP for direct HTTP printing from browser.
 * The ZD421 WiFi card exposes an HTTP endpoint at /pstprnt.
 */
const PRINTER_IP = process.env.NEXT_PUBLIC_ZEBRA_PRINTER_IP || '192.168.1.111';

/**
 * Detect if running in Zebra Enterprise Browser
 */
const isEnterpriseBrowser = () => {
  if (typeof window === 'undefined') return false;
  return navigator.userAgent.includes('EnterpriseBrowser');
};

/**
 * Check if Web Bluetooth is available
 */
const hasWebBluetooth = () => {
  if (typeof navigator === 'undefined') return false;
  return 'bluetooth' in navigator;
};

/**
 * Get Enterprise Browser PrinterZebra API (correct API structure)
 */
const getEBPrinterZebra = () => {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    EB?: {
      PrinterZebra?: {
        CONNECTION_TYPE_BLUETOOTH: string;
        PRINTER_TYPE_ZEBRA: string;
        searchPrinters: (
          options: { connectionType: string; printerType?: string; timeout?: number },
          callback: (result: { status: string; printerID?: string; message?: string }) => void
        ) => void;
        getPrinterByID: (printerID: string) => {
          connect: (callback: (result: { status: string; message?: string }) => void) => void;
          disconnect: (callback: (result: { status: string }) => void) => void;
          printRawString: (
            data: string,
            options: Record<string, unknown>,
            callback: (result: { status: string; message?: string }) => void
          ) => void;
        };
      };
    };
  };
  return win.EB?.PrinterZebra || null;
};

/**
 * ZebraPrint - Printing for Zebra printers
 *
 * Supports (in priority order):
 * 1. WiFi - Direct TCP printing via server API route (fastest, no pairing needed)
 * 2. Enterprise Browser - EB.PrinterZebra API for Bluetooth Classic
 * 3. Web Bluetooth - Direct BLE printing from Chrome (fallback)
 * 4. Desktop - Zebra Browser Print SDK
 */
const ZebraPrint = ({
  onConnectionChange,
  onPrintComplete,
  onPrintReady,
}: ZebraPrintProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [connectionType, setConnectionType] = useState<'wifi' | 'eb' | 'ble' | 'desktop' | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Refs for persistent connections
  const ebPrinterRef = useRef<ReturnType<NonNullable<ReturnType<typeof getEBPrinterZebra>>['getPrinterByID']> | null>(null);
  const bleDeviceRef = useRef<BluetoothDevice | null>(null);
  const bleCharacteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const desktopDeviceRef = useRef<unknown>(null);

  // ============================================
  // WiFi Printing (direct HTTP to printer)
  // ============================================
  const checkWifiPrinter = useCallback(async () => {
    try {
      // Try to reach the printer's built-in web server directly from the browser.
      // Uses no-cors since the printer doesn't set CORS headers.
      // If the printer is reachable on the local network, the fetch succeeds (opaque response).
      // If not reachable, it throws a network error.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      await fetch(`http://${PRINTER_IP}/`, {
        mode: 'no-cors',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      setPrinterName('Zebra ZD421 (WiFi)');
      setIsConnected(true);
      setConnectionType('wifi');
      setError(null);
      onConnectionChange?.(true);
      return true;
    } catch {
      return false;
    }
  }, [onConnectionChange]);

  // ============================================
  // Enterprise Browser Printing (Bluetooth Classic)
  // ============================================
  const searchEBPrinters = useCallback(() => {
    // Debug: Log what APIs are available
    const win = window as unknown as { EB?: unknown };
    console.log('=== EB Debug ===');
    console.log('window.EB:', win.EB);
    console.log('typeof window.EB:', typeof win.EB);
    if (win.EB && typeof win.EB === 'object') {
      console.log('EB keys:', Object.keys(win.EB as object));
    }

    const ebPrinter = getEBPrinterZebra();
    console.log('ebPrinter:', ebPrinter);

    // Collect debug info
    const ebObj = win.EB as Record<string, unknown> | undefined;
    const availableAPIs = ebObj ? Object.keys(ebObj).join(', ') : 'none';
    setDebugInfo(`EB APIs: ${availableAPIs}`);

    if (!ebPrinter) {
      setError(`EB.PrinterZebra not found. Available: ${availableAPIs}`);
      return;
    }

    setIsSearching(true);
    setError(null);

    // Use hardcoded strings as fallback
    const connectionType = ebPrinter.CONNECTION_TYPE_BLUETOOTH || 'CONNECTION_TYPE_BLUETOOTH';
    const printerType = ebPrinter.PRINTER_TYPE_ZEBRA || 'PRINTER_TYPE_ZEBRA';

    console.log('Searching with:', { connectionType, printerType });

    ebPrinter.searchPrinters(
      {
        connectionType,
        printerType,
        timeout: 30000,
      },
      (result) => {
        console.log('EB searchPrinters result:', result);

        if (result.status === 'PRINTER_STATUS_SUCCESS' && result.printerID) {
          // Found a printer - get the printer object
          const printer = ebPrinter.getPrinterByID(result.printerID);
          ebPrinterRef.current = printer;
          setPrinterName(result.printerID);
          setIsConnected(true);
          setConnectionType('eb');
          setError(null);
          setIsSearching(false);
          onConnectionChange?.(true);
        } else if (result.status === 'PRINTER_STATUS_ERROR' || result.message) {
          setError(result.message || 'Search failed');
          setIsSearching(false);
          onConnectionChange?.(false);
        }
        // Keep searching if status is something else (e.g., 'PRINTER_STATUS_SUCCESS' without printerID means still searching)
      }
    );
  }, [onConnectionChange]);

  // ============================================
  // Web Bluetooth Printing (BLE)
  // ============================================
  const connectWebBluetooth = useCallback(async () => {
    if (!hasWebBluetooth()) {
      setError('Web Bluetooth not available');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      // Request device - try name filter first, then accept all printers
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'ZD421' },
          { namePrefix: 'Zebra' },
          { namePrefix: 'ZTC' },
        ],
        optionalServices: [ZEBRA_PARSER_SERVICE, ZEBRA_WRITE_CHARACTERISTIC],
      });

      if (!device.gatt) {
        throw new Error('GATT not available');
      }

      // Connect to GATT server
      const server = await device.gatt.connect();

      // Get Zebra parser service
      const service = await server.getPrimaryService(ZEBRA_PARSER_SERVICE);

      // Get write characteristic
      const characteristic = await service.getCharacteristic(ZEBRA_WRITE_CHARACTERISTIC);

      bleDeviceRef.current = device;
      bleCharacteristicRef.current = characteristic;
      setPrinterName(device.name || 'Zebra Printer (BLE)');
      setIsConnected(true);
      setConnectionType('ble');
      setError(null);
      setIsSearching(false);
      onConnectionChange?.(true);

      // Handle disconnection
      device.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
        setPrinterName(null);
        bleDeviceRef.current = null;
        bleCharacteristicRef.current = null;
        onConnectionChange?.(false);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'BLE connection failed';
      setError(message);
      setIsSearching(false);
      onConnectionChange?.(false);
    }
  }, [onConnectionChange]);

  // ============================================
  // Desktop Zebra Browser Print SDK
  // ============================================
  const checkDesktopConnection = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const BrowserPrint = (window as unknown as { BrowserPrint?: ZebraBrowserPrint }).BrowserPrint;
    if (!BrowserPrint) {
      return;
    }

    BrowserPrint.getDefaultDevice(
      'printer',
      (device: ZebraDevice) => {
        if (device) {
          desktopDeviceRef.current = device;
          setPrinterName(device.name || 'Zebra Printer');
          setIsConnected(true);
          setConnectionType('desktop');
          setError(null);
          onConnectionChange?.(true);
        }
      },
      () => {
        // No device found - not an error, just no printer
      }
    );
  }, [onConnectionChange]);

  // ============================================
  // Print Function
  // ============================================
  const print = useCallback(
    async (zpl: string): Promise<boolean> => {
      // WiFi printing (direct HTTP POST to printer's /pstprnt endpoint)
      if (connectionType === 'wifi') {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          await fetch(`http://${PRINTER_IP}/pstprnt`, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: zpl,
            signal: controller.signal,
          });
          clearTimeout(timeout);

          // With no-cors the response is opaque, but if fetch didn't throw
          // the data was sent to the printer successfully
          onPrintComplete?.(true);
          return true;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'WiFi print failed';
          onPrintComplete?.(false, message);
          return false;
        }
      }

      // Enterprise Browser printing
      if (connectionType === 'eb' && ebPrinterRef.current) {
        return new Promise((resolve) => {
          const printer = ebPrinterRef.current!;

          printer.connect((connectResult) => {
            console.log('EB connect result:', connectResult);

            if (connectResult.status === 'PRINTER_STATUS_SUCCESS') {
              printer.printRawString(zpl, {}, (printResult) => {
                console.log('EB print result:', printResult);

                printer.disconnect(() => {
                  if (printResult.status === 'PRINTER_STATUS_SUCCESS') {
                    onPrintComplete?.(true);
                    resolve(true);
                  } else {
                    onPrintComplete?.(false, printResult.message || 'Print failed');
                    resolve(false);
                  }
                });
              });
            } else {
              onPrintComplete?.(false, connectResult.message || 'Connect failed');
              resolve(false);
            }
          });
        });
      }

      // Web Bluetooth printing
      if (connectionType === 'ble' && bleCharacteristicRef.current) {
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(zpl);

          // BLE requires chunking - max ~300 bytes per write
          const chunkSize = 300;

          for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, Math.min(i + chunkSize, data.length));
            await bleCharacteristicRef.current.writeValue(chunk);

            // Delay between chunks for Android
            if (i + chunkSize < data.length) {
              await new Promise(resolve => setTimeout(resolve, 250));
            }
          }

          onPrintComplete?.(true);
          return true;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'BLE print failed';
          onPrintComplete?.(false, message);
          return false;
        }
      }

      // Desktop Browser Print SDK
      if (connectionType === 'desktop' && desktopDeviceRef.current) {
        const device = desktopDeviceRef.current as ZebraDevice;
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
            }
          );
        });
      }

      onPrintComplete?.(false, 'No printer connected');
      return false;
    },
    [connectionType, onPrintComplete]
  );

  // ============================================
  // Initialization - WiFi first, then fallbacks
  // ============================================
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setIsSearching(true);

      // Try WiFi first (works on all devices)
      const wifiOk = await checkWifiPrinter();
      if (wifiOk || cancelled) {
        setIsSearching(false);
        return;
      }

      // Fallback: Enterprise Browser
      if (isEnterpriseBrowser()) {
        setTimeout(() => {
          if (!cancelled) searchEBPrinters();
        }, 1500);
        return;
      }

      // Fallback: Desktop Browser Print
      setIsSearching(false);
      void checkDesktopConnection();
    };

    void init();

    // Re-check desktop connection periodically (if not EB)
    let interval: ReturnType<typeof setInterval> | undefined;
    if (!isEnterpriseBrowser()) {
      interval = setInterval(checkDesktopConnection, 10000);
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [checkWifiPrinter, searchEBPrinters, checkDesktopConnection]);

  // Expose print function
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

  // ============================================
  // UI
  // ============================================
  const handleConnect = () => {
    if (isEnterpriseBrowser()) {
      searchEBPrinters();
    } else if (hasWebBluetooth()) {
      void connectWebBluetooth();
    }
  };

  const connectionLabel = connectionType === 'wifi'
    ? 'WiFi'
    : connectionType === 'eb'
      ? 'Bluetooth'
      : connectionType === 'ble'
        ? 'BLE'
        : 'USB';

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border-primary bg-fill-secondary px-3 py-2">
      <Icon
        icon={connectionType === 'wifi' ? IconWifi : isConnected ? IconPrinter : IconPrinterOff}
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
        {isConnected && connectionType && (
          <Typography variant="bodyXs" colorRole="muted">
            {connectionLabel}
          </Typography>
        )}
        {!isConnected && !isSearching && (
          <button
            onClick={handleConnect}
            className="text-left text-xs text-blue-500 underline"
          >
            {hasWebBluetooth() ? 'Connect Printer' : 'Search Again'}
          </button>
        )}
        {error && (
          <Typography variant="bodyXs" colorRole="muted" className="text-red-500">
            {error}
          </Typography>
        )}
        {debugInfo && (
          <Typography variant="bodyXs" colorRole="muted" className="text-gray-400">
            {debugInfo}
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
}

export default ZebraPrint;

export const useZebraPrint = () => {
  if (typeof window === 'undefined') {
    return { print: async () => false, isConnected: () => false };
  }
  const zebraPrint = (window as unknown as { zebraPrint?: { print: (zpl: string) => Promise<boolean>; isConnected: () => boolean } }).zebraPrint;
  return {
    print: zebraPrint?.print ?? (async () => false),
    isConnected: zebraPrint?.isConnected ?? (() => false),
  };
};
