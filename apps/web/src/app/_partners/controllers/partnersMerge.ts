import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import type { PartnerReference as Reference } from '../utils/partnerReferenceColumns';
import partnerReferenceColumns, {
  SAFE_IDENTIFIER,
} from '../utils/partnerReferenceColumns';

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

    const targets = await partnerReferenceColumns();

    /*
      Every unique key covering a column about to be repointed.

      Both records holding a row under the same key is the normal case, and the
      reason the duplicate hurts: two rows cannot share one key, so repointing
      collides. There is one sensible reading of that — a business has one set
      of margins and one release per wine, and the survivor's is the one in use
      — so the duplicate's copy is dropped rather than blocking the merge.

      Read from the database for the same reason the references are: a
      hard-coded list of "the unique ones" goes stale silently.
    */
    const uniqueIndexes = await db.execute<{
      table_name: string;
      columns: string[];
    }>(sql`
      SELECT t.relname AS table_name,
             array_agg(a.attname ORDER BY k.ord) AS columns
        FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
       WHERE i.indisunique
         AND n.nspname = 'public'
         AND i.indpred IS NULL
         AND i.indexprs IS NULL
       GROUP BY t.relname, i.indexrelid
    `);

    /**
     * Rows on the duplicate that cannot move because the survivor already holds
     * the same unique key.
     *
     * Read from pg_index, not information_schema: `uniqueIndex()` in the schema
     * creates a bare unique INDEX, which has no row in
     * information_schema.table_constraints at all. Missing those made a merge
     * fail outright instead of resolving — wms_pricing_releases is unique on
     * (lwin_key, owner_id), both records had released the same wines, and all
     * 372 repointed rows collided at once.
     *
     * For a single-column key this reduces to "the survivor has any row here",
     * which is exactly the behaviour it replaces.
     */
    const collisionPredicate = (target: Reference) => {
      const covering = [...uniqueIndexes].filter(
        (index) =>
          index.table_name === target.table &&
          index.columns.includes(target.column) &&
          index.columns.every((column) => SAFE_IDENTIFIER.test(column)),
      );

      if (covering.length === 0) return null;

      const clauses = covering.map((index) => {
        const others = index.columns.filter(
          (column) => column !== target.column,
        );
        const sameKey = others.map((column) =>
          sql.raw(
            `survivor_row."${column}" IS NOT DISTINCT FROM dup_row."${column}"`,
          ),
        );

        return sql`EXISTS (
          SELECT 1 FROM ${sql.raw(`"${target.table}"`)} survivor_row
           WHERE survivor_row.${sql.raw(`"${target.column}"`)} = ${survivorId}
           ${others.length > 0 ? sql`AND ${sql.join(sameKey, sql` AND `)}` : sql``}
        )`;
      });

      return sql.join(clauses, sql` OR `);
    };

    // Counted first so a dry run can report the move, and a real one has a
    // record of what it touched
    const counts: {
      table: string;
      column: string;
      /** Rows the duplicate holds here */
      rows: number;
      /** Of those, how many the survivor already has under the same key */
      discarded: number;
      /** Any at all — kept so the summary can name the tables that lost rows */
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

      const collides = collisionPredicate(target);
      let discarded = 0;

      if (collides) {
        const [held] = await db.execute<{ n: number }>(sql`
          SELECT COUNT(*)::int AS n
            FROM ${sql.raw(`"${target.table}"`)} dup_row
           WHERE dup_row.${sql.raw(`"${target.column}"`)} = ${duplicateId}
             AND (${collides})
        `);

        discarded = Number(held?.n ?? 0);
      }

      counts.push({ ...target, rows, discarded, discard: discarded > 0 });
    }

    if (dryRun) {
      return {
        dryRun: true,
        survivor: survivor.businessName,
        duplicate: duplicate.businessName,
        moved: counts,
        totalRows: counts.reduce((sum, c) => sum + (c.rows - c.discarded), 0),
      };
    }

    await db.transaction(async (tx) => {
      for (const target of counts) {
        try {
          if (target.discarded > 0) {
            /*
              Only the rows that actually collide. Deleting everything the
              duplicate held here — which is what a table-wide delete did —
              threw away releases and overrides the survivor did NOT have, so
              a merge quietly lost data instead of gathering it.
            */
            const collides = collisionPredicate(target);

            await tx.execute(sql`
              DELETE FROM ${sql.raw(`"${target.table}"`)} dup_row
               WHERE dup_row.${sql.raw(`"${target.column}"`)} = ${duplicateId}
                 AND (${collides})
            `);
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
