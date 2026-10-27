import { sql } from 'drizzle-orm';

import db from '@/database/client';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The global client or an open transaction — whichever the caller writes with */
export type DbExecutor = typeof db | Tx;

export interface NextDocumentNumberParams {
  /** Run on the caller's transaction so rows it has not committed yet count */
  executor?: DbExecutor;
  /** E.g. 'MOV' — the number reads MOV-2026-0042 */
  code: string;
  /** Table and column that hold the numbers (fixed identifiers, never input) */
  table: string;
  column: string;
  /** Postgres sequence created by migrate.mjs; used when present */
  sequence: string;
}

/*
  Fallback path only: numbers already handed out on an executor that may not
  be in the table yet (taken, not yet inserted), so two calls in a row on the
  same transaction never return the same number.
*/
const handedOut = new WeakMap<object, Map<string, number>>();

const rowsOf = (result: unknown) =>
  (Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? [])) as Array<
    Record<string, unknown>
  >;

/**
 * Hand out the next WMS document number (MOV-, PL-, RPK-, CC-, …).
 *
 * The old generators each read "the last number" with the global client and
 * added one. Two scans at the same moment got the same number and one failed on
 * the unique index; inside a transaction the read could not see the
 * transaction's own rows, so a second movement in the same transaction always
 * collided (multi-line pool purchases could never confirm); and the text sort
 * put MOV-2026-9999 above MOV-2026-10000.
 *
 * Now: a Postgres sequence (one per document type, seeded from the highest
 * number in use) gives every caller a distinct number with no race. If the
 * sequence does not exist yet — migrations have not run — it falls back to the
 * numeric maximum read on the caller's executor, serialised by a
 * transaction-scoped advisory lock.
 *
 * Numbers keep counting across a new year rather than restarting at 0001.
 */
const nextDocumentNumber = async ({
  executor = db,
  code,
  table,
  column,
  sequence,
}: NextDocumentNumberParams) => {
  const year = new Date().getFullYear();
  const prefix = `${code}-${year}-`;
  const pattern = `^${code}-[0-9]{4}-([0-9]+)$`;

  const readMax = async () => {
    const result = await executor.execute(sql`
      SELECT COALESCE(MAX(substring(${sql.identifier(column)} FROM ${pattern})::bigint), 0) AS max
        FROM ${sql.identifier(table)}
       WHERE ${sql.identifier(column)} LIKE ${`${code}-%`}
    `);
    return Number(rowsOf(result)[0]?.max ?? 0);
  };

  // nextval(NULL) is NULL, so a missing sequence reads as "not there" rather
  // than raising an error that would abort the caller's transaction.
  const takeFromSequence = async () => {
    const result = await executor.execute(
      sql`SELECT nextval(to_regclass(${sequence})) AS n`,
    );
    const value = rowsOf(result)[0]?.n;
    return value === null || value === undefined ? null : Number(value);
  };

  let next = await takeFromSequence();

  if (next !== null) {
    const max = await readMax();

    // Seeded behind the data (a number written by the fallback path, say):
    // move the sequence past it once and take again.
    if (next <= max) {
      await executor.execute(
        sql`SELECT setval(to_regclass(${sequence}), GREATEST(${max}::bigint, (SELECT last_value FROM ${sql.identifier(sequence)})))`,
      );
      next = (await takeFromSequence()) ?? max + 1;
    }
  } else {
    // Holds until the caller's transaction ends; a no-op guard outside one.
    await executor.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`wms_number_${code}`}))`,
    );
    const issued = handedOut.get(executor) ?? new Map<string, number>();
    handedOut.set(executor, issued);
    next = Math.max(await readMax(), issued.get(code) ?? 0) + 1;
    issued.set(code, next);
  }

  return `${prefix}${next.toString().padStart(4, '0')}`;
};

export default nextDocumentNumber;
