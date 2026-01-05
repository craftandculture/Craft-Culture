import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { z } from 'zod';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import clientConfig from '@/client.config';
import db from '@/database/client';
import { sessions, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * Admin endpoint to impersonate a user
 *
 * Creates a new session for the target user that allows
 * the admin to view the platform as that user.
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

    // Get the target user
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

    // Generate a unique session token
    const sessionToken = crypto.randomUUID();

    // Create impersonation session (expires in 1 hour)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const headersList = await headers();
    const ipAddress =
      headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip');
    const userAgent = headersList.get('user-agent');

    const [newSession] = await db
      .insert(sessions)
      .values({
        userId: targetUser.id,
        token: sessionToken,
        expiresAt,
        ipAddress,
        userAgent,
        impersonatedBy: admin.id,
      })
      .returning();

    if (!newSession) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create impersonation session',
      });
    }

    // Set the session cookie
    const cookieStore = await cookies();
    cookieStore.set(`${clientConfig.cookiePrefix}.session_token`, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

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
        sessionId: newSession.id,
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
