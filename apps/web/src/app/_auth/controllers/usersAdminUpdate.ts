import { TRPCError } from '@trpc/server';
import { and, count, eq, ne } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { sessions, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).optional(),
  customerType: z.enum(['b2b', 'b2c', 'private_clients']).optional(),
  role: z.enum(['user', 'admin', 'wms_operator']).optional(),
  approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
});

/**
 * Admin endpoint to update user details
 *
 * Allows admins to modify user name, customer type, role, and approval status.
 * An admin cannot change their own role or approval status, since saving it
 * would lock them out of the screen that undoes it, and no change may leave
 * the platform without an approved admin.
 */
const usersAdminUpdate = adminProcedure
  .input(inputSchema)
  .mutation(async ({ input, ctx }) => {
    const { userId, ...updates } = input;

    const [current] = await db
      .select({ role: users.role, approvalStatus: users.approvalStatus })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!current) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
    }

    // The forms always send role and status, so only a real change counts
    const roleChanges =
      updates.role !== undefined && updates.role !== current.role;
    const statusChanges =
      updates.approvalStatus !== undefined &&
      updates.approvalStatus !== current.approvalStatus;

    if (userId === ctx.user.id && (roleChanges || statusChanges)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Ask another admin to change your own access',
      });
    }

    const removesAdmin =
      current.role === 'admin' &&
      current.approvalStatus === 'approved' &&
      ((roleChanges && updates.role !== 'admin') ||
        (statusChanges && updates.approvalStatus !== 'approved'));

    if (removesAdmin) {
      const [otherAdmins] = await db
        .select({ n: count() })
        .from(users)
        .where(
          and(
            eq(users.role, 'admin'),
            eq(users.approvalStatus, 'approved'),
            ne(users.id, userId),
          ),
        );

      if (!otherAdmins || otherAdmins.n === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This is the only approved admin, so their access stays',
        });
      }
    }

    // Build update object only with provided fields
    const updateData: Record<string, unknown> = {};

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.customerType !== undefined) {
      updateData.customerType = updates.customerType;
    }
    if (updates.role !== undefined) {
      updateData.role = updates.role;
    }
    if (updates.approvalStatus !== undefined) {
      updateData.approvalStatus = updates.approvalStatus;

      // If approving, record who approved and when
      if (updates.approvalStatus === 'approved') {
        updateData.approvedAt = new Date();
        updateData.approvedBy = ctx.user.id;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, message: 'No updates provided' };
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        customerType: users.customerType,
        role: users.role,
        approvalStatus: users.approvalStatus,
      });

    /* New access applies now, not when their old sessions expire. */
    if (roleChanges || statusChanges) {
      await db.delete(sessions).where(eq(sessions.userId, userId));
    }

    return { success: true, user: updatedUser };
  });

export default usersAdminUpdate;
