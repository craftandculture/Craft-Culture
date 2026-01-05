import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { z } from 'zod';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
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
 * impersonation session for the target user.
 */
const usersAdminImpersonate = adminProcedure
  .input(inputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userId } = input;
    const admin = ctx.user;

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
    const ipAddress =
      headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip');
    const userAgent = headersList.get('user-agent');

    // Use Better Auth's admin plugin to create impersonation session
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

    // Log the impersonation
    await logAdminActivity({
      adminId: admin.id,
      action: 'user.impersonation_started',
      entityType: 'user',
      entityId: targetUser.id,
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
      metadata: {
        targetUserId: targetUser.id,
        targetUserEmail: targetUser.email,
        targetUserName: targetUser.name,
      },
    });

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
