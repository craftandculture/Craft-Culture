import { getSessionCookie } from 'better-auth/cookies';
import { NextRequest, NextResponse } from 'next/server';

import clientConfig from './client.config';

const protectedRoutes = [
  /(?:^|\/)([\w-]+\/)?platform/,
  /(?:^|\/)([\w-]+\/)?welcome/,
];

/** WMS routes that can be accessed with device token */
const wmsRoutes = [
  /\/platform\/admin\/wms/,
];

export const middleware = async (request: NextRequest) => {
  const { pathname, searchParams } = request.nextUrl;

  // Check for device token in URL (for Enterprise Browser/TC27)
  const deviceToken = searchParams.get('device_token');
  const wmsDeviceToken = process.env.WMS_DEVICE_TOKEN;

  // Allow WMS routes with valid device token
  if (deviceToken && wmsDeviceToken && deviceToken === wmsDeviceToken) {
    if (wmsRoutes.some((route) => route.test(pathname))) {
      return NextResponse.next();
    }
  }

  const hasSession =
    getSessionCookie(request, {
      cookiePrefix: clientConfig.cookiePrefix,
    }) !== null || request.headers.get('Authorization') !== null;

  if (protectedRoutes.some((route) => route.test(pathname)) && !hasSession) {
    return NextResponse.redirect(
      new URL(`/sign-in?next=${pathname}`, request.url),
    );
  }

  return NextResponse.next();
};

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|s3).*)'],
};
