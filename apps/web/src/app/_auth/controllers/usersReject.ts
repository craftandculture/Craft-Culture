import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import z from 'zod';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import db from '@/database/client';
import { users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Reject a user's account application
 *
 * Admin-only action that updates user's approval status to 'rejected'
 * User will see pending message when they try to access platform
 */
const usersReject = adminProcedure
  .input(
    z.object({
      userId: z.string().uuid(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { userId } = input;

    // Get the user to reject
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

    if (user.approvalStatus === 'rejected') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'User is already rejected',
      });
    }

    // Update user to rejected status
    await db
      .update(users)
      .set({
        approvalStatus: 'rejected',
      })
      .where(eq(users.id, userId));

    // Log the rejection action
    await logAdminActivity({
      adminId: ctx.user.id,
      action: 'user.rejected',
      entityType: 'user',
      entityId: userId,
      metadata: {
        userEmail: user.email,
        userName: user.name,
        previousStatus: user.approvalStatus,
      },
    });

    return { success: true };
  });

export default usersReject;
