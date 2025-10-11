import { getSessionCookie } from 'better-auth/cookies';
import { NextRequest, NextResponse } from 'next/server';

const protectedRoutes = [/(?:^|\/)([\w-]+\/)?platform/];

const authRoutes = [/(?:^|\/)([\w-]+\/)?sign-in/];

export const middleware = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;

  const hasSession =
    getSessionCookie(request) !== null ||
    request.headers.get('Authorization') !== null;

  console.log('hasSession', hasSession);

  if (protectedRoutes.some((route) => route.test(pathname)) && !hasSession) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  if (authRoutes.some((route) => route.test(pathname)) && hasSession) {
    return NextResponse.redirect(new URL('/platform', request.url));
  }

  return NextResponse.next();
};

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|s3).*)'],
};
