import { getSessionCookie } from 'better-auth/cookies';
import { NextRequest, NextResponse } from 'next/server';

import clientConfig from './client.config';
import {
  WMS_DEVICE_COOKIE,
  WMS_DEVICE_COOKIE_MAX_AGE_SECONDS,
  WMS_DEVICE_HEADER,
} from './lib/wms/deviceTokenCookie';
import constantTimeEqual from './utils/constantTimeEqual';

const protectedRoutes = [
  /(?:^|\/)([\w-]+\/)?platform/,
  /(?:^|\/)([\w-]+\/)?welcome/,
];

/** WMS routes that can be accessed with device token */
const wmsRoutes = [
  /\/platform\/admin\/wms/,
  /\/wms\//,
];

export const middleware = async (request: NextRequest) => {
  const { pathname, searchParams } = request.nextUrl;
  const wmsDeviceToken = process.env.WMS_DEVICE_TOKEN?.trim();
  const isWmsRoute = wmsRoutes.some((route) => route.test(pathname));

  if (isWmsRoute && wmsDeviceToken) {
    /*
      Enterprise Browser / TC27 scanners can only open a link, so the first
      visit carries ?device_token=. Swap it for an httpOnly cookie and redirect
      to the same URL without it, so the token is not left in the address bar,
      history or a Referer header. Later requests (pages, tRPC, the print
      download) authenticate with the cookie or an x-device-token header.
    */
    const queryToken = searchParams.get('device_token')?.trim();
    if (queryToken && constantTimeEqual(queryToken, wmsDeviceToken)) {
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.searchParams.delete('device_token');
      const response = NextResponse.redirect(cleanUrl);
      response.cookies.set(WMS_DEVICE_COOKIE, queryToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: WMS_DEVICE_COOKIE_MAX_AGE_SECONDS,
      });
      response.headers.set('Referrer-Policy', 'no-referrer');
      return response;
    }

    const deviceToken =
      request.headers.get(WMS_DEVICE_HEADER)?.trim() ??
      request.cookies.get(WMS_DEVICE_COOKIE)?.value;

    // Constant-time: edge runtime has no node crypto
    if (deviceToken && constantTimeEqual(deviceToken, wmsDeviceToken)) {
      const response = NextResponse.next();
      response.headers.set('x-pathname', pathname);
      response.headers.set('Referrer-Policy', 'no-referrer');
      return response;
    }
  }

  // Only a real session cookie counts; an arbitrary Authorization header does not
  const hasSession =
    getSessionCookie(request, {
      cookiePrefix: clientConfig.cookiePrefix,
    }) !== null;

  if (protectedRoutes.some((route) => route.test(pathname)) && !hasSession) {
    return NextResponse.redirect(
      new URL(`/sign-in?next=${pathname}`, request.url),
    );
  }

  // Add pathname header for server components to access current route
  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);
  return response;
};

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|s3).*)'],
};
