import { type NextRequest, NextResponse } from 'next/server';

import auth from '@/lib/better-auth/server';
import { WMS_DEVICE_COOKIE, WMS_DEVICE_HEADER } from '@/lib/wms/deviceTokenCookie';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

/**
 * Device sign-in for warehouse scanners (TC27)
 *
 * Usage: GET /api/auth/device?token=YOUR_DEVICE_TOKEN, or with the token in an
 * `x-device-token` header or the device cookie
 *
 * Scanners normally sign in with the warehouse PIN (/warehouse). That sets the
 * device cookie, and middleware sends a WMS page whose session has lapsed back
 * here, so the scanner is signed in again without anyone typing anything. The
 * session itself is made by the warehouse sign-in endpoint, so its cookie is
 * signed like any other. Every response sets Referrer-Policy: no-referrer.
 *
 * Configured by WMS_DEVICE_TOKEN (a secure random token, never shown) and
 * WMS_DEVICE_USER_EMAIL (the warehouse login).
 */
const handleDeviceAuth = async (request: NextRequest) => {
  const url = new URL(request.url);
  const token =
    request.headers.get(WMS_DEVICE_HEADER) ??
    url.searchParams.get('token') ??
    request.cookies.get(WMS_DEVICE_COOKIE)?.value;

  // Validate redirect to prevent open redirect attacks
  const allowedPrefixes = ['/platform/', '/wms/'];
  const rawRedirect = url.searchParams.get('redirect') || '/platform/admin/wms';
  const redirect = allowedPrefixes.some((p) => rawRedirect.startsWith(p)) ? rawRedirect : '/platform/admin/wms';
  const baseUrl = serverConfig.appUrl.toString().replace(/\/$/, '');

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/warehouse?next=${encodeURIComponent(redirect)}`);
  }

  const response = await auth.api.warehouseSignIn({
    body: { deviceToken: token },
    headers: request.headers,
    asResponse: true,
  });

  if (!response.ok) {
    logger.warn('[Device Auth] Refused', { status: response.status });
    // A stale device cookie goes to the PIN page rather than a dead end
    const refused = NextResponse.redirect(`${baseUrl}/warehouse?next=${encodeURIComponent(redirect)}`);
    refused.cookies.delete(WMS_DEVICE_COOKIE);
    return refused;
  }

  const redirectResponse = NextResponse.redirect(`${baseUrl}${redirect}`);
  for (const cookie of response.headers.getSetCookie()) {
    redirectResponse.headers.append('set-cookie', cookie);
  }
  return redirectResponse;
};

export const GET = async (request: NextRequest) => {
  const response = await handleDeviceAuth(request);
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
};

export default GET;
