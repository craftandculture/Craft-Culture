import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import clientConfig from '@/client.config';
import db from '@/database/client';
import { sessions, users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

/**
 * Stop impersonating a user
 *
 * Deletes the impersonation session and logs the admin out.
 * Admin will need to log back in to continue.
 */
const usersStopImpersonate = protectedProcedure.mutation(async () => {
  // Get the session token from cookie
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(
    `${clientConfig.cookiePrefix}.session_token`,
  )?.value;

  if (!sessionToken) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'No active session',
    });
  }

  // Find the current session
  const [currentSession] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, sessionToken))
    .limit(1);

  if (!currentSession) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Session not found',
    });
  }

  // Verify this is an impersonation session
  if (!currentSession.impersonatedBy) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Not currently impersonating anyone',
    });
  }

  // Get the admin who was impersonating
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.id, currentSession.impersonatedBy))
    .limit(1);

  // Get the user who was being impersonated
  const [impersonatedUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, currentSession.userId))
    .limit(1);

  const headersList = await headers();
  const ipAddress =
    headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip');
  const userAgent = headersList.get('user-agent');

  // Log the end of impersonation
  if (admin) {
    await logAdminActivity({
      adminId: admin.id,
      action: 'user.impersonation_ended',
      entityType: 'user',
      entityId: impersonatedUser?.id,
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
      metadata: {
        targetUserId: impersonatedUser?.id,
        targetUserEmail: impersonatedUser?.email,
        targetUserName: impersonatedUser?.name,
        sessionId: currentSession.id,
      },
    });
  }

  // Delete the impersonation session
  await db.delete(sessions).where(eq(sessions.id, currentSession.id));

  // Clear the session cookie
  cookieStore.delete(`${clientConfig.cookiePrefix}.session_token`);

  return {
    success: true,
    message: 'Impersonation ended. Please log in again.',
  };
});

export default usersStopImpersonate;
