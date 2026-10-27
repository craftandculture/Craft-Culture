import crypto from 'node:crypto';
import net from 'node:net';

import { NextRequest, NextResponse } from 'next/server';

import { WMS_DEVICE_COOKIE, WMS_DEVICE_HEADER } from '@/lib/wms/deviceTokenCookie';
import serverConfig from '@/server.config';

/** Device token from the header or the httpOnly cookie middleware sets; never the URL */
const presentedDeviceToken = (request: NextRequest) =>
  request.headers.get(WMS_DEVICE_HEADER) ?? request.cookies.get(WMS_DEVICE_COOKIE)?.value ?? null;

const NO_REFERRER = { 'Referrer-Policy': 'no-referrer' };

/** Constant-time comparison of a supplied device token against the configured one. */
const isValidDeviceToken = (supplied: string | null | undefined) => {
  const expected = serverConfig.wmsDeviceToken?.trim();
  const given = supplied?.trim();
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

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
 * Usage: /api/wms/print?zpl=base64encodedZPL, with the device cookie or an
 * x-device-token header
 */
export const GET = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const deviceToken = presentedDeviceToken(request);
  const zplParam = searchParams.get('zpl'); // direct ZPL content (base64 encoded)

  // Validate device token (constant-time)
  if (!isValidDeviceToken(deviceToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_REFERRER });
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
      ...NO_REFERRER,
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
  const body = (await request.json()) as { zpl?: string; device_token?: string };
  const { zpl } = body;

  // Require the same device token as GET (header, cookie or body) before
  // opening a socket to the internal printer — otherwise any caller could send
  // raw ZPL.
  const deviceToken = presentedDeviceToken(request) ?? body.device_token ?? null;
  if (!isValidDeviceToken(deviceToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    console.error('WiFi print error', { error: err });
    return NextResponse.json({ error: message }, { status: 502 });
  }
};
