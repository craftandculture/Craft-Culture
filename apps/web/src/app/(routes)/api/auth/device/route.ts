import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import db from '@/database/client';
import { users } from '@/database/schema';
import auth from '@/lib/better-auth/server';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

/**
 * Device authentication endpoint for WMS terminals (TC27)
 *
 * This allows warehouse devices to authenticate without magic links
 * by using a pre-shared device token stored in environment variables.
 *
 * Usage: GET /api/auth/device?token=YOUR_DEVICE_TOKEN
 *
 * The device token and user email must be configured in:
 * - WMS_DEVICE_TOKEN: A secure random token
 * - WMS_DEVICE_USER_EMAIL: The email of the user to authenticate as
 */
export const GET = async (request: NextRequest) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const redirect = url.searchParams.get('redirect') || '/platform/admin/wms/labels';

  logger.info('[Device Auth] Authentication attempt', {
    hasToken: !!token,
    redirect,
    userAgent: request.headers.get('user-agent')?.substring(0, 100),
  });

  // Validate device token
  if (!serverConfig.wmsDeviceToken || !serverConfig.wmsDeviceUserEmail) {
    logger.error('[Device Auth] Device authentication not configured');
    return NextResponse.json(
      { error: 'Device authentication not configured' },
      { status: 500 },
    );
  }

  if (!token || token !== serverConfig.wmsDeviceToken) {
    logger.warn('[Device Auth] Invalid token attempt');
    return NextResponse.json(
      { error: 'Invalid device token' },
      { status: 401 },
    );
  }

  // Find the user
  const user = await db.query.users.findFirst({
    where: eq(users.email, serverConfig.wmsDeviceUserEmail),
  });

  if (!user) {
    logger.error('[Device Auth] User not found', {
      email: serverConfig.wmsDeviceUserEmail,
    });
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 },
    );
  }

  try {
    // Use Better Auth's internal API to create a session
    // This ensures the session is created in the format Better Auth expects
    const response = await auth.api.signInEmail({
      body: {
        email: serverConfig.wmsDeviceUserEmail,
        // Better Auth magic link plugin allows empty password when callbackURL is provided
        password: '',
        callbackURL: redirect,
      },
      asResponse: true,
      headers: request.headers,
    });

    // If sign-in requires verification, create session directly using internal context
    if (!response.ok) {
      // Fallback: Create session using Better Auth's internal adapter
      const ctx = await auth.$context;
      const sessionResult = await ctx.internalAdapter.createSession(
        user.id,
        request.headers,
        false, // not remember me
      );

      if (!sessionResult) {
        throw new Error('Failed to create session');
      }

      logger.info('[Device Auth] Session created via internal adapter', {
        userId: user.id,
        sessionId: sessionResult.session.id,
      });

      // Build redirect response with session cookie
      const baseUrl = serverConfig.appUrl.toString().replace(/\/$/, '');
      const redirectResponse = NextResponse.redirect(`${baseUrl}${redirect}`);

      // Set the session cookie
      const cookieName = ctx.authCookies.sessionToken.name;
      redirectResponse.cookies.set(cookieName, sessionResult.session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: sessionResult.session.expiresAt,
      });

      return redirectResponse;
    }

    // If sign-in succeeded, forward the response (it has the cookie set)
    logger.info('[Device Auth] Session created via signInEmail', {
      userId: user.id,
    });

    return response;
  } catch (error) {
    logger.error('[Device Auth] Failed to create session', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: user.id,
    });

    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 },
    );
  }
};

export default GET;
