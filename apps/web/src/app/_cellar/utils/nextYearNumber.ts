import { and, like, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

import type db from '@/database/client';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The database, or a transaction on it */
export type NumberExecutor = Tx | typeof db;

/**
 * The next year-scoped reference for a table, such as REL-2026-0008
 *
 * The highest number is read as a NUMBER, not as text: ordering the text put
 * REL-2026-9999 above REL-2026-10000, so the ten-thousandth reference would
 * have been issued again forever after. `offset` lets a caller that collided
 * with a concurrent save step past the number it just lost to.
 *
 * Pass the transaction the insert runs in, so the read sees the same snapshot.
 *
 * @example
 *   await nextYearNumber(
 *     tx,
 *     cellarReleaseRequests,
 *     cellarReleaseRequests.requestNumber,
 *     'REL',
 *   );
 *
 * @param executor - The database or a transaction
 * @param table - The table holding the references
 * @param column - Its reference column
 * @param code - The prefix, such as 'REL'
 * @param offset - How many numbers past the next free one (after a clash)
 * @returns The reference
 */
const nextYearNumber = async (
  executor: NumberExecutor,
  table: PgTable,
  column: PgColumn,
  code: string,
  offset = 0,
) => {
  const prefix = `${code}-${new Date().getFullYear()}-`;
  const start = prefix.length + 1;

  const [row] = await executor
    .select({
      max: sql<number>`COALESCE(MAX(CAST(substring(${column} from ${start}::int) AS integer)), 0)::int`,
    })
    .from(table)
    .where(
      and(
        like(column, `${prefix}%`),
        sql`substring(${column} from ${start}::int) ~ '^[0-9]+$'`,
      ),
    );

  const next = Number(row?.max ?? 0) + 1 + offset;

  return `${prefix}${String(next).padStart(4, '0')}`;
};

export default nextYearNumber;
