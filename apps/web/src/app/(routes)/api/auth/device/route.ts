import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import clientConfig from '@/client.config';
import db from '@/database/client';
import { sessions, users } from '@/database/schema';
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

  // Create a session token
  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Insert session into database
  const [session] = await db
    .insert(sessions)
    .values({
      userId: user.id,
      token: sessionToken,
      expiresAt,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    })
    .returning();

  logger.info('[Device Auth] Session created', {
    userId: user.id,
    sessionId: session.id,
    expiresAt,
  });

  // Set the session cookie
  const cookieStore = await cookies();
  const cookieName = `${clientConfig.cookiePrefix}.session_token`;

  cookieStore.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  // Redirect to the target page
  const baseUrl = serverConfig.appUrl.toString().replace(/\/$/, '');
  return NextResponse.redirect(`${baseUrl}${redirect}`);
};

export default GET;
