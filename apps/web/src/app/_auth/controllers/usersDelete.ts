import { TRPCError } from '@trpc/server';
import { and, eq, ne, sql } from 'drizzle-orm';
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
 * ("approved by", "updated by", activity) are kept with that field cleared.
 * Records that must keep an author (e.g. a shipment they created, a document
 * they uploaded) are reassigned to the admin deleting them, and the
 * reassignment is written to the admin activity log.
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

    /*
      Never the last staff admin. With no admin left nobody could approve,
      manage or restore accounts from the app.
    */
    if (user.role === 'admin') {
      const [others] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(
          and(
            eq(users.role, 'admin'),
            ne(users.id, userId),
            sql`lower(${users.email}) LIKE '%@craftculture.xyz'`,
          ),
        );

      if (Number(others?.n ?? 0) === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This is the last admin account and cannot be deleted.',
        });
      }
    }

    // Most columns pointing at a user have no ON DELETE rule, so the delete
    // itself would fail on the first one holding a row
    const references = (await userReferenceColumns()).filter(
      (ref) => !ref.handledByDatabase,
    );

    // One round trip for every column, rather than one per column
    const counts =
      references.length === 0
        ? []
        : [
            ...(await db.execute<{ i: number; n: number }>(
              sql.join(
                references.map(
                  (ref, i) => sql`
                    SELECT ${i}::int AS i, count(*)::int AS n
                      FROM ${sql.identifier(ref.table)}
                     WHERE ${sql.identifier(ref.column)} = ${userId}`,
                ),
                sql` UNION ALL `,
              ),
            )),
          ];
    const held = counts
      .filter((c) => c.n > 0)
      .map((c) => ({ ref: references[c.i]!, n: c.n }));

    const cleared: Record<string, number> = {};
    const reassigned: Record<string, number> = {};
    await db.transaction(async (tx) => {
      for (const { ref } of held) {
        // A record that must name someone keeps the deleting admin instead
        const replacement = ref.nullable ? null : ctx.user.id;
        const result = await tx.execute(sql`
          UPDATE ${sql.identifier(ref.table)}
             SET ${sql.identifier(ref.column)} = ${replacement}
           WHERE ${sql.identifier(ref.column)} = ${userId}
        `);
        if (result.count > 0) {
          (ref.nullable ? cleared : reassigned)[`${ref.table}.${ref.column}`] =
            result.count;
        }
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
        reassignedToAdmin: reassigned,
      },
    });

    return { success: true };
  });

export default usersDelete;
