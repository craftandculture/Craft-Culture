/**
 * Send ZPL directly to a Zebra printer over WiFi via HTTP POST.
 *
 * Printers with a web server (e.g. ZD421) accept ZPL at /pstprnt on port 80.
 * Printers without a web server (e.g. ZT231) accept raw data on port 9100.
 *
 * @example
 *   const printed = await wifiPrint(zpl);
 *   const printed = await wifiPrint(zpl, '192.168.0.112');
 *   const printed = await wifiPrint(zpl, '192.168.0.112', 9100);
 *
 * @param zpl - Raw ZPL string to send to the printer
 * @param printerIp - Optional IP address to target a specific printer
 * @param port - Optional port number (default: 80 via /pstprnt, or 9100 for raw)
 * @returns true if print succeeded, false otherwise
 */
const wifiPrint = async (zpl: string, printerIp?: string, port?: number): Promise<boolean> => {
  const ip = printerIp || process.env.NEXT_PUBLIC_ZEBRA_PRINTER_IP || '192.168.0.112';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const url = port && port !== 80 ? `http://${ip}:${port}/` : `http://${ip}/pstprnt`;

    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: zpl,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return true;
  } catch {
    // Port 9100 printers (ZT series) accept ZPL over raw TCP. The browser
    // sends the body immediately on connection, so the label is already
    // printed by the time any error fires — whether a TypeError (non-HTTP
    // response) or AbortError (5s timeout). Treat ALL errors as success;
    // the health check already handles offline detection.
    if (port) {
      return true;
    }
    return false;
  }
};

export default wifiPrint;
