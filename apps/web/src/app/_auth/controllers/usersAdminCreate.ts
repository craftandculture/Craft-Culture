import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import db from '@/database/client';
import { users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  customerType: z.enum(['b2b', 'b2c', 'private_clients']),
  role: z.enum(['user', 'admin']).default('user'),
  approvalStatus: z.enum(['pending', 'approved', 'rejected']).default('approved'),
});

/**
 * Admin endpoint to create a new user
 *
 * Allows admins to create users directly without requiring them to self-register.
 * The user can then sign in using magic link.
 */
const usersAdminCreate = adminProcedure
  .input(inputSchema)
  .mutation(async ({ input, ctx }) => {
    const { email, name, customerType, role, approvalStatus } = input;

    // Check if user already exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'A user with this email already exists',
      });
    }

    // Create the new user
    const [newUser] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email,
        name,
        customerType,
        role,
        approvalStatus,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        // If pre-approved, record who approved
        approvedAt: approvalStatus === 'approved' ? new Date() : null,
        approvedBy: approvalStatus === 'approved' ? ctx.user.id : null,
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        customerType: users.customerType,
        role: users.role,
        approvalStatus: users.approvalStatus,
        createdAt: users.createdAt,
      });

    // Log the creation action
    await logAdminActivity({
      adminId: ctx.user.id,
      action: 'user.created',
      entityType: 'user',
      entityId: newUser.id,
      metadata: {
        userEmail: newUser.email,
        userName: newUser.name,
        customerType: newUser.customerType,
        role: newUser.role,
        approvalStatus: newUser.approvalStatus,
      },
    });

    return { success: true, user: newUser };
  });

export default usersAdminCreate;
