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
  /\/wms\//,
];

export const middleware = async (request: NextRequest) => {
  const { pathname, searchParams } = request.nextUrl;

  // Check for device token in URL (for Enterprise Browser/TC27)
  const deviceToken = searchParams.get('device_token');
  // TODO: Move to env var WMS_DEVICE_TOKEN after fixing Vercel config
  const wmsDeviceToken = 'wms_device_2026_CraftCulture_TC27';

  // Allow WMS routes with valid device token
  if (deviceToken && wmsDeviceToken && deviceToken === wmsDeviceToken) {
    if (wmsRoutes.some((route) => route.test(pathname))) {
      const response = NextResponse.next();
      response.headers.set('x-pathname', pathname);
      return response;
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

  // Add pathname header for server components to access current route
  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);
  return response;
};

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|s3).*)'],
};
