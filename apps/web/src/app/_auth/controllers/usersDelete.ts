import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import z from 'zod';

import logAdminActivity from '@/app/_admin/utils/logAdminActivity';
import db from '@/database/client';
import { users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import userReferenceColumns from '../utils/userReferenceColumns';

/**
 * Delete a user's account
 *
 * Admin-only action that permanently deletes a user. Rows the database
 * removes itself (sessions, accounts) go with them; records they only touched
 * ("approved by", "updated by", activity) are kept with that field cleared. A
 * user who is the required author of a record (e.g. created a shipment) is
 * refused with a list of what holds them, as deleting would orphan it.
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

    // Most columns pointing at a user have no ON DELETE rule, so the delete
    // itself would fail on the first one holding a row
    const references = (await userReferenceColumns()).filter(
      (ref) => !ref.handledByDatabase,
    );

    const countRows = async (table: string, column: string) => {
      const [row] = await db.execute<{ n: number }>(sql`
        SELECT count(*)::int AS n FROM ${sql.identifier(table)}
         WHERE ${sql.identifier(column)} = ${userId}
      `);
      return row?.n ?? 0;
    };

    const blockers: string[] = [];
    for (const ref of references.filter((r) => !r.nullable)) {
      const n = await countRows(ref.table, ref.column);
      if (n > 0) blockers.push(`${ref.table.replace(/_/g, ' ')} (${n})`);
    }

    if (blockers.length > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `${user.name ?? user.email} cannot be deleted: they are recorded as the author of ${blockers.join(', ')}. Reject the account instead to remove their access.`,
      });
    }

    const cleared: Record<string, number> = {};
    await db.transaction(async (tx) => {
      for (const ref of references.filter((r) => r.nullable)) {
        const result = await tx.execute(sql`
          UPDATE ${sql.identifier(ref.table)}
             SET ${sql.identifier(ref.column)} = NULL
           WHERE ${sql.identifier(ref.column)} = ${userId}
        `);
        if (result.count > 0) cleared[`${ref.table}.${ref.column}`] = result.count;
      }
      await tx.delete(users).where(eq(users.id, userId));
    });

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
        clearedReferences: cleared,
      },
    });

    return { success: true };
  });

export default usersDelete;
