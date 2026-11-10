import { type NextRequest, NextResponse } from 'next/server';

import auth from '@/lib/better-auth/server';
import { WMS_DEVICE_COOKIE, WMS_DEVICE_COOKIE_MAX_AGE_SECONDS, WMS_DEVICE_HEADER } from '@/lib/wms/deviceTokenCookie';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';
import matchesSecret from '@/utils/matchesSecret';

/**
 * Device sign-in for warehouse scanners (TC27)
 *
 * Usage: the device cookie or an `x-device-token` header. A `?token=` link
 * still works for a scanner set up with one, but only as far as being swapped
 * for the device cookie (see below); new scanners should use a WMS link with
 * `?device_token=` or the PIN instead.
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

  // Validate redirect to prevent open redirect attacks
  const allowedPrefixes = ['/platform/', '/wms/'];
  const rawRedirect = url.searchParams.get('redirect') || '/platform/admin/wms';
  const redirect = allowedPrefixes.some((p) => rawRedirect.startsWith(p)) ? rawRedirect : '/platform/admin/wms';
  const baseUrl = serverConfig.appUrl.toString().replace(/\/$/, '');

  /*
    A token in the address is never used to sign in directly: it would sit in
    the address bar and the browser history of a shared scanner. A right one
    is swapped for the httpOnly device cookie and the request made again
    without it, as middleware does with ?device_token=. Kept rather than
    removed because a scanner may have been set up with this link, and
    dropping it would send that scanner to the PIN screen.
  */
  const queryToken = url.searchParams.get('token')?.trim();
  const expected = serverConfig.wmsDeviceToken?.trim();
  if (queryToken && !request.headers.get(WMS_DEVICE_HEADER)) {
    if (expected && matchesSecret(queryToken, expected)) {
      const clean = new URL(`${baseUrl}/api/auth/device`);
      clean.searchParams.set('redirect', redirect);
      const swapped = NextResponse.redirect(clean);
      swapped.cookies.set(WMS_DEVICE_COOKIE, expected, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: WMS_DEVICE_COOKIE_MAX_AGE_SECONDS,
      });
      return swapped;
    }
    // A stale link is ignored, not acted on, so a good device cookie still signs the scanner in
    logger.warn('[Device Auth] Ignored a wrong token in the address');
  }

  const token = request.headers.get(WMS_DEVICE_HEADER) ?? request.cookies.get(WMS_DEVICE_COOKIE)?.value;

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
