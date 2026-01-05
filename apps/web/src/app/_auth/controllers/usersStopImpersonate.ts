import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import clientConfig from '@/client.config';
import db from '@/database/client';
import { sessions, users } from '@/database/schema';
import authServerClient from '@/lib/better-auth/server';
import { protectedProcedure } from '@/lib/trpc/procedures';

/**
 * Stop impersonating a user
 *
 * Uses Better Auth's admin plugin to properly end the impersonation session
 * and restore the admin's original session.
 */
const usersStopImpersonate = protectedProcedure.mutation(async () => {
  // Get the session token from cookie to find impersonation details for logging
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(
    `${clientConfig.cookiePrefix}.session_token`,
  )?.value;

  let adminId: string | null = null;
  let impersonatedUser: { id: string; email: string; name: string | null } | null = null;

  if (sessionToken) {
    // Find the current session for logging purposes
    const [currentSession] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.token, sessionToken))
      .limit(1);

    if (currentSession?.impersonatedBy) {
      adminId = currentSession.impersonatedBy;

      // Get the user who was being impersonated
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
        })
        .from(users)
        .where(eq(users.id, currentSession.userId))
        .limit(1);

      impersonatedUser = user ?? null;
    }
  }

  const headersList = await headers();
  const ipAddress =
    headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip');
  const userAgent = headersList.get('user-agent');

  // Use Better Auth's admin plugin to stop impersonating
  const result = await authServerClient.api.stopImpersonating({
    headers: headersList,
  });

  if (!result) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Not currently impersonating anyone',
    });
  }

  // Log the end of impersonation
  if (adminId) {
    await logAdminActivity({
      adminId,
      action: 'user.impersonation_ended',
      entityType: 'user',
      entityId: impersonatedUser?.id,
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
      metadata: {
        targetUserId: impersonatedUser?.id,
        targetUserEmail: impersonatedUser?.email,
        targetUserName: impersonatedUser?.name,
      },
    });
  }

  return {
    success: true,
    message: 'Impersonation ended. You are now logged in as yourself.',
  };
});

export default usersStopImpersonate;
