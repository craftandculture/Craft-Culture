/**
 * Send ZPL directly to the Zebra printer over WiFi via HTTP POST.
 *
 * The ZD421's built-in web server accepts raw ZPL at /pstprnt.
 * Requires Chrome mixed-content flag set for the printer IP.
 *
 * @example
 *   const printed = await wifiPrint(zpl);
 *   if (!printed) downloadZplFile(zpl, filename);
 *
 * @param zpl - Raw ZPL string to send to the printer
 * @returns true if print succeeded, false otherwise
 */
const wifiPrint = async (zpl: string): Promise<boolean> => {
  const printerIp = process.env.NEXT_PUBLIC_ZEBRA_PRINTER_IP || '192.168.1.111';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    await fetch(`http://${printerIp}/pstprnt`, {
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
