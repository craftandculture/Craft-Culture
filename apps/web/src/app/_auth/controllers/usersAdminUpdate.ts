import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).optional(),
  customerType: z.enum(['b2b', 'b2c', 'private_clients']).optional(),
  role: z.enum(['user', 'admin']).optional(),
  approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
});

/**
 * Admin endpoint to update user details
 *
 * Allows admins to modify user name, customer type, role, and approval status.
 */
const usersAdminUpdate = adminProcedure
  .input(inputSchema)
  .mutation(async ({ input, ctx }) => {
    const { userId, ...updates } = input;

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

    return { success: true, user: updatedUser };
  });

export default usersAdminUpdate;
