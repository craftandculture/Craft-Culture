/**
 * Send ZPL directly to a Zebra printer over WiFi via HTTP POST.
 *
 * Printers with a web server (e.g. ZD421) accept ZPL at /pstprnt on port 80.
 * Printers without a web server (e.g. ZT231) accept raw data on port 9100.
 *
 * @example
 *   const printed = await wifiPrint(zpl);
 *   const printed = await wifiPrint(zpl, '192.168.1.236');
 *   const printed = await wifiPrint(zpl, '192.168.1.205', 9100);
 *
 * @param zpl - Raw ZPL string to send to the printer
 * @param printerIp - Optional IP address to target a specific printer
 * @param port - Optional port number (default: 80 via /pstprnt, or 9100 for raw)
 * @returns true if print succeeded, false otherwise
 */
const wifiPrint = async (zpl: string, printerIp?: string, port?: number): Promise<boolean> => {
  const ip = printerIp || process.env.NEXT_PUBLIC_ZEBRA_PRINTER_IP || '192.168.1.236';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const url = port ? `http://${ip}:${port}/` : `http://${ip}/pstprnt`;

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
    return false;
  }
};

export default wifiPrint;
