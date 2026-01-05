import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import db from '@/database/client';
import { users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z
  .object({
    email: z.string().email().optional(),
    name: z.string().min(1),
    customerType: z.enum(['b2b', 'b2c', 'private_clients']),
    role: z.enum(['user', 'admin']).default('user'),
    approvalStatus: z
      .enum(['pending', 'approved', 'rejected'])
      .default('approved'),
    isTestUser: z.boolean().default(false),
  })
  .refine(
    (data) => {
      // Email is required for regular users, optional for test users
      if (!data.isTestUser && !data.email) {
        return false;
      }
      return true;
    },
    { message: 'Email is required for non-test users', path: ['email'] },
  );

/**
 * Admin endpoint to create a new user
 *
 * Allows admins to create users directly without requiring them to self-register.
 * The user can then sign in using magic link.
 */
const usersAdminCreate = adminProcedure
  .input(inputSchema)
  .mutation(async ({ input, ctx }) => {
    const { name, customerType, role, approvalStatus, isTestUser } = input;

    // Generate placeholder email for test users
    const userId = crypto.randomUUID();
    const email = isTestUser
      ? `test-${userId.slice(0, 8)}@placeholder.local`
      : input.email!;

    // Check if user already exists (skip for test users since email is unique)
    if (!isTestUser) {
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
    }

    // Create the new user
    const [newUser] = await db
      .insert(users)
      .values({
        id: userId,
        email,
        name,
        customerType,
        role,
        approvalStatus,
        isTestUser,
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
        isTestUser: users.isTestUser,
        createdAt: users.createdAt,
      });

    if (!newUser) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create user',
      });
    }

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
        isTestUser: newUser.isTestUser,
      },
    });

    return { success: true, user: newUser };
  });

export default usersAdminCreate;
