/**
 * Send ZPL directly to a Zebra printer over WiFi via HTTP POST.
 *
 * The printer's built-in web server accepts raw ZPL at /pstprnt.
 * Requires Chrome mixed-content flag set for the printer IP.
 *
 * @example
 *   const printed = await wifiPrint(zpl);
 *   const printed = await wifiPrint(zpl, '192.168.1.200');
 *
 * @param zpl - Raw ZPL string to send to the printer
 * @param printerIp - Optional IP address to target a specific printer
 * @returns true if print succeeded, false otherwise
 */
const wifiPrint = async (zpl: string, printerIp?: string): Promise<boolean> => {
  const ip = printerIp || process.env.NEXT_PUBLIC_ZEBRA_PRINTER_IP || '192.168.1.237';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    await fetch(`http://${ip}/pstprnt`, {
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
