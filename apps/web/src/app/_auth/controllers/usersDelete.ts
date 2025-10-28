import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import z from 'zod';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import db from '@/database/client';
import { users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Delete a user's account
 *
 * Admin-only action that permanently deletes a user and all associated data
 * Use with caution - this action cannot be undone
 */
const usersDelete = adminProcedure
  .input(
    z.object({
      userId: z.string().uuid(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { userId } = input;

    // Prevent admin from deleting themselves
    if (userId === ctx.user.id) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'You cannot delete your own account',
      });
    }

    // Get the user to delete
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    // Delete the user (cascading deletes will handle related records)
    await db.delete(users).where(eq(users.id, userId));

    // Log the deletion action
    await logAdminActivity({
      adminId: ctx.user.id,
      action: 'user.deleted',
      entityType: 'user',
      entityId: userId,
      metadata: {
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        approvalStatus: user.approvalStatus,
      },
    });

    return { success: true };
  });

export default usersDelete;
