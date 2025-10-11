import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

const publicRoutes = [
  /^\/$/,
  /^\/authorize/,
  /^\/sign-in/,
  /^\/sign-up/,
  /^\/forgot-password/,
  /^\/update-password/,
  /^\/playground/,
  /^\/dashboard/,
  /^\/pricing/,
  /^\/policies/,
  /^\/articles/,
];

const authRoutes = [
  /^\/sign-in/,
  /^\/sign-up/,
  /^\/forgot-password/,
  /^\/update-password/,
];

export async function middleware(request: NextRequest) {
  const hasSession =
    getSessionCookie(request, {
      cookiePrefix: 'easybooker',
    }) !== null;

  const isPublic = publicRoutes.some((route) =>
    route.test(request.nextUrl.pathname),
  );

  const isAuth = authRoutes.some((route) =>
    route.test(request.nextUrl.pathname),
  );

  const search = new URLSearchParams(request.nextUrl.search);

  if (!search.has('token') && request.nextUrl.pathname === '/update-password') {
    return NextResponse.redirect(new URL('/forgot-password', request.nextUrl));
  }

  if (!search.has('next')) {
    search.set('next', request.nextUrl.pathname);
  }

  if (hasSession && isAuth) {
    return NextResponse.redirect(new URL('/dashboard', request.nextUrl));
  }

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = `/sign-in`;
    url.search = search.toString();
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!api|_next|next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
