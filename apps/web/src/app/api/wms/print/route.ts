import net from 'node:net';

import { NextRequest, NextResponse } from 'next/server';

import serverConfig from '@/server.config';

/**
 * Send raw data to a TCP socket (Zebra printer on port 9100)
 */
const sendToPrinter = (host: string, port: number, data: string) => {
  return new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();
    const timeout = 5000;

    socket.setTimeout(timeout);

    socket.connect(port, host, () => {
      socket.write(data, 'utf-8', (err) => {
        socket.end();
        if (err) {
          reject(new Error(`Failed to write to printer: ${err.message}`));
        } else {
          resolve();
        }
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`Connection to printer at ${host}:${port} timed out`));
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(new Error(`Printer connection error: ${err.message}`));
    });
  });
};

/**
 * Direct ZPL file download endpoint for Enterprise Browser
 *
 * This bypasses JavaScript issues by returning the ZPL as a standard HTTP file download.
 * Enterprise Browser handles this reliably.
 *
 * Usage: /api/wms/print?zpl=base64encodedZPL&device_token=xxx
 */
export const GET = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const deviceToken = searchParams.get('device_token');
  const zplParam = searchParams.get('zpl'); // direct ZPL content (base64 encoded)

  // Validate device token
  const expectedToken = serverConfig.wmsDeviceToken?.trim();
  if (!deviceToken || deviceToken !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let zpl = '';

  // If direct ZPL is provided (base64 encoded), decode and use it
  if (zplParam) {
    try {
      zpl = Buffer.from(zplParam, 'base64').toString('utf-8');
    } catch {
      return NextResponse.json({ error: 'Invalid ZPL data' }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: 'ZPL data required' }, { status: 400 });
  }

  // Return as downloadable file
  return new NextResponse(zpl, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="labels-${Date.now()}.zpl"`,
    },
  });
};

/**
 * Send ZPL to Zebra printer over WiFi (TCP port 9100)
 *
 * @example
 *   fetch('/api/wms/print', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ zpl: '^XA^FO50,50^ADN,36,20^FDHello^FS^XZ' }),
 *   });
 */
export const POST = async (request: NextRequest) => {
  const { zpl } = (await request.json()) as { zpl?: string };

  if (!zpl || typeof zpl !== 'string') {
    return NextResponse.json({ error: 'ZPL data required' }, { status: 400 });
  }

  const printerIp = serverConfig.zebraPrinterIp;
  const printerPort = serverConfig.zebraPrinterPort;

  try {
    await sendToPrinter(printerIp, printerPort, zpl);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Print failed';
    console.error('WiFi print error', { error: err, printerIp, printerPort });
    return NextResponse.json({ error: message }, { status: 502 });
  }
};
