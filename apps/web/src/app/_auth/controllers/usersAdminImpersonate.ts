import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { z } from 'zod';

import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';
import db from '@/database/client';
import { users } from '@/database/schema';
import authServerClient from '@/lib/better-auth/server';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * Admin endpoint to impersonate a user
 *
 * Uses Better Auth's admin plugin to create a properly signed
 * impersonation session for the target user. Staff only: partners holding
 * admin logins may not impersonate. The same rule is enforced on the auth
 * endpoint itself, and the audit entry is written by the session create hook
 * in lib/better-auth/server.ts, so neither can be skipped by calling the
 * endpoint directly from the browser.
 */
const usersAdminImpersonate = adminProcedure
  .input(inputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userId } = input;
    const admin = ctx.user;

    if (!isTeamMember(admin)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only C&C staff can impersonate users',
      });
    }

    // Prevent self-impersonation
    if (userId === admin.id) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot impersonate yourself',
      });
    }

    // Get the target user for logging
    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    const headersList = await headers();

    // Use Better Auth's admin plugin to create impersonation session. The
    // session create hook records the impersonation in the admin audit log.
    const result = await authServerClient.api.impersonateUser({
      body: { userId },
      headers: headersList,
    });

    if (!result) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create impersonation session',
      });
    }

    return {
      success: true,
      targetUser: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
    };
  });

export default usersAdminImpersonate;
