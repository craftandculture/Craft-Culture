import { NextRequest, NextResponse } from 'next/server';

import serverConfig from '@/server.config';

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
