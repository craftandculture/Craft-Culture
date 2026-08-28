import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/** A table and column pointing at partners.id */
interface Reference {
  table: string;
  column: string;
}

/** Postgres identifiers, as Postgres itself writes them */
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/**
 * Move everything one partner record owns onto another, and retire it
 *
 * Two records for one business splits its stock, its shipments and — worst —
 * its pricing. Owner margins are keyed on the partner id, so a rate set against
 * one record silently does not apply to wine held under the other.
 *
 * The columns to repoint are discovered from the database rather than listed
 * here. There are over forty foreign keys onto `partners`, the set grows with
 * the schema, and a merge that misses one leaves rows pointing at a partner
 * that is no longer used — which is worse than not merging at all, because it
 * looks done. Asking Postgres what references the table cannot fall behind it.
 *
 * The whole move runs in one transaction. A unique constraint can legitimately
 * collide — the same user belonging to both records, say — and a merge that
 * half-succeeds would leave the split it was sent to repair. It fails whole,
 * naming the table, so the collision can be cleared first.
 *
 * The duplicate is not deleted. It is marked inactive and renamed to record
 * where its rows went, so anything holding a stale id still resolves and the
 * history of the merge is legible.
 */
const partnersMerge = adminProcedure
  .input(
    z.object({
      /** The record that survives and receives everything */
      survivorId: z.string().uuid(),
      /** The record being retired */
      duplicateId: z.string().uuid(),
      /** Report what would move without moving it */
      dryRun: z.boolean().default(true),
    }),
  )
  .mutation(async ({ input }) => {
    const { survivorId, duplicateId, dryRun } = input;

    if (survivorId === duplicateId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'A partner cannot be merged into itself',
      });
    }

    const found = await db
      .select({ id: partners.id, businessName: partners.businessName })
      .from(partners)
      .where(sql`${partners.id} IN (${survivorId}, ${duplicateId})`);

    const survivor = found.find((p) => p.id === survivorId);
    const duplicate = found.find((p) => p.id === duplicateId);

    if (!survivor || !duplicate) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'One of those partner records does not exist',
      });
    }

    // Every column in the database pointing at partners.id, asked of Postgres
    const references = await db.execute<{ table_name: string; column_name: string }>(sql`
      SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
         AND kcu.constraint_schema = tc.constraint_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.constraint_schema = tc.constraint_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = 'public'
         AND ccu.table_name = 'partners'
         AND ccu.column_name = 'id'
    `);

    const targets: Reference[] = references
      .map((r) => ({ table: r.table_name, column: r.column_name }))
      .filter(
        (r) =>
          SAFE_IDENTIFIER.test(r.table) &&
          SAFE_IDENTIFIER.test(r.column) &&
          r.table !== 'partners',
      );

    /*
      Columns where a partner can only ever have one row.

      Owner pricing settings key on the partner id as their PRIMARY key, so
      both records having margins — which is the normal case, and the reason
      the duplicate hurts — makes repointing impossible: two rows cannot share
      one key. There is only one sensible reading of that. A business has one
      set of margins, the surviving record's are the ones in use, and the
      duplicate's are discarded rather than blocking the merge.

      Read from the database for the same reason the references are: a
      hard-coded list of "the unique ones" goes stale silently.
    */
    const uniqueColumns = await db.execute<{ table_name: string; column_name: string }>(sql`
      SELECT tc.table_name, MIN(kcu.column_name) AS column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
         AND kcu.constraint_schema = tc.constraint_schema
       WHERE tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
         AND tc.table_schema = 'public'
       GROUP BY tc.table_name, tc.constraint_name
      HAVING COUNT(*) = 1
    `);

    const singular = new Set(
      [...uniqueColumns].map((r) => `${r.table_name}.${r.column_name}`),
    );

    // Counted first so a dry run can report the move, and a real one has a
    // record of what it touched
    const counts: {
      table: string;
      column: string;
      rows: number;
      /** The survivor already has its own row here, so this one goes */
      discard: boolean;
    }[] = [];

    for (const target of targets) {
      const [row] = await db.execute<{ n: number }>(sql`
        SELECT COUNT(*)::int AS n
          FROM ${sql.raw(`"${target.table}"`)}
         WHERE ${sql.raw(`"${target.column}"`)} = ${duplicateId}
      `);

      const rows = Number(row?.n ?? 0);

      if (rows === 0) continue;

      let discard = false;

      if (singular.has(`${target.table}.${target.column}`)) {
        const [held] = await db.execute<{ n: number }>(sql`
          SELECT COUNT(*)::int AS n
            FROM ${sql.raw(`"${target.table}"`)}
           WHERE ${sql.raw(`"${target.column}"`)} = ${survivorId}
        `);

        discard = Number(held?.n ?? 0) > 0;
      }

      counts.push({ ...target, rows, discard });
    }

    if (dryRun) {
      return {
        dryRun: true,
        survivor: survivor.businessName,
        duplicate: duplicate.businessName,
        moved: counts,
        totalRows: counts
          .filter((c) => !c.discard)
          .reduce((sum, c) => sum + c.rows, 0),
      };
    }

    await db.transaction(async (tx) => {
      for (const target of counts) {
        try {
          if (target.discard) {
            // The survivor's own row is the one in use; this one cannot move
            // onto it and must not be left pointing at a retired record.
            await tx.execute(sql`
              DELETE FROM ${sql.raw(`"${target.table}"`)}
               WHERE ${sql.raw(`"${target.column}"`)} = ${duplicateId}
            `);

            continue;
          }

          await tx.execute(sql`
            UPDATE ${sql.raw(`"${target.table}"`)}
               SET ${sql.raw(`"${target.column}"`)} = ${survivorId}
             WHERE ${sql.raw(`"${target.column}"`)} = ${duplicateId}
          `);
        } catch (error) {
          // Named, because the fix is specific: clear the clashing row on one
          // side and run the merge again.
          throw new TRPCError({
            code: 'CONFLICT',
            message:
              `Could not move ${target.rows} row(s) in "${target.table}"."${target.column}" — ` +
              'the survivor probably already has a row that would clash. ' +
              'Nothing has been changed.',
            cause: error,
          });
        }
      }

      /*
        Retired rather than deleted. Something outside the database may hold
        the old id — an export, a Zoho record, a bookmarked URL — and a row
        that still resolves and says where its contents went is more useful
        than a broken reference.
      */
      await tx
        .update(partners)
        .set({
          status: 'inactive',
          businessName: `${duplicate.businessName} (merged into ${survivor.businessName})`,
          notes: sql`COALESCE(${partners.notes} || E'\n', '') || ${`Merged into ${survivor.businessName} (${survivorId})`}`,
        })
        .where(eq(partners.id, duplicateId));
    });

    logger.info('[PartnersMerge] Merged partner records', {
      survivorId,
      duplicateId,
      tablesTouched: counts.length,
      rowsMoved: counts.reduce((sum, c) => sum + c.rows, 0),
    });

    return {
      dryRun: false,
      survivor: survivor.businessName,
      duplicate: duplicate.businessName,
      moved: counts,
      // Counted the same way the preview counts it. Including the discarded
      // rows here made the result claim one more row than the preview had
      // promised, and called a deleted row "moved".
      totalRows: counts
        .filter((c) => !c.discard)
        .reduce((sum, c) => sum + c.rows, 0),
      discardedRows: counts
        .filter((c) => c.discard)
        .reduce((sum, c) => sum + c.rows, 0),
    };
  });

export default partnersMerge;
