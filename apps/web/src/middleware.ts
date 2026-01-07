import { getSessionCookie } from 'better-auth/cookies';
import { NextRequest, NextResponse } from 'next/server';

import clientConfig from './client.config';

const protectedRoutes = [
  /(?:^|\/)([\w-]+\/)?platform/,
  /(?:^|\/)([\w-]+\/)?welcome/,
];

export const middleware = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;

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
