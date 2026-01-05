import { TRPCError } from '@trpc/server';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import db from '@/database/client';
import { users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email('Please enter a valid email address'),
});

/**
 * Admin endpoint to activate a test user by assigning a real email address
 *
 * Converts a test user to a regular user that can sign in via magic link.
 */
const usersActivateTestUser = adminProcedure
  .input(inputSchema)
  .mutation(async ({ input, ctx }) => {
    const { userId, email } = input;
    const normalizedEmail = email.toLowerCase().trim();

    // Get the test user
    const [testUser] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        isTestUser: users.isTestUser,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!testUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    if (!testUser.isTestUser) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This user is not a test user',
      });
    }

    // Check if the email is already in use by another user
    const [emailInUse] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, normalizedEmail), ne(users.id, userId)))
      .limit(1);

    if (emailInUse) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This email is already in use by another account',
      });
    }

    // Activate the test user
    const [activatedUser] = await db
      .update(users)
      .set({
        email: normalizedEmail,
        isTestUser: false,
        emailVerified: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        isTestUser: users.isTestUser,
      });

    if (!activatedUser) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to activate test user',
      });
    }

    // Log the activation
    await logAdminActivity({
      adminId: ctx.user.id,
      action: 'user.test_activated',
      entityType: 'user',
      entityId: userId,
      metadata: {
        previousEmail: testUser.email,
        newEmail: normalizedEmail,
        userName: testUser.name,
      },
    });

    return {
      success: true,
      user: activatedUser,
      message: `Test user activated. ${activatedUser.name} can now sign in with ${normalizedEmail}`,
    };
  });

export default usersActivateTestUser;
