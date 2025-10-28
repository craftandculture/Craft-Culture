import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import z from 'zod';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import db from '@/database/client';
import { users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Approve a user's account, allowing them to access the platform
 *
 * Admin-only action that updates user's approval status to 'approved'
 * and records who approved them and when
 */
const usersApprove = adminProcedure
  .input(
    z.object({
      userId: z.string().uuid(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { userId } = input;

    // Get the user to approve
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

    if (user.approvalStatus === 'approved') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'User is already approved',
      });
    }

    // Update user to approved status
    await db
      .update(users)
      .set({
        approvalStatus: 'approved',
        approvedAt: new Date(),
        approvedBy: ctx.user.id,
      })
      .where(eq(users.id, userId));

    // Log the approval action
    await logAdminActivity({
      adminId: ctx.user.id,
      action: 'user_approved',
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

export default usersApprove;
