import { TRPCError } from '@trpc/server';
import { and, eq, ne } from 'drizzle-orm';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import db from '@/database/client';
import { users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import adminChangeEmailSchema from '../schemas/adminChangeEmailSchema';

/**
 * Admin endpoint to change a user's email address
 *
 * This allows admins to update the login email for any user.
 * The user will need to use the new email for magic link sign-in.
 */
const usersAdminChangeEmail = adminProcedure
  .input(adminChangeEmailSchema)
  .mutation(async ({ input, ctx }) => {
    const { userId, newEmail } = input;
    const normalizedEmail = newEmail.toLowerCase().trim();

    // Can't change your own email through admin panel
    if (userId === ctx.user.id) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot change your own email through admin panel',
      });
    }

    // Get the user to update
    const [existingUser] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!existingUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    // Check if the email is the same
    if (existingUser.email.toLowerCase() === normalizedEmail) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'New email is the same as current email',
      });
    }

    // Check if the new email is already in use by another user
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

    // Update the email
    const [updatedUser] = await db
      .update(users)
      .set({
        email: normalizedEmail,
        emailVerified: false, // Reset verification since email changed
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
      });

    if (!updatedUser) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update user email',
      });
    }

    // Log the email change
    await logAdminActivity({
      adminId: ctx.user.id,
      action: 'user.email_changed',
      entityType: 'user',
      entityId: userId,
      metadata: {
        previousEmail: existingUser.email,
        newEmail: normalizedEmail,
        userName: existingUser.name,
      },
    });

    return {
      success: true,
      user: updatedUser,
      message: `Email updated successfully. The user can now sign in with ${normalizedEmail}`,
    };
  });

export default usersAdminChangeEmail;
