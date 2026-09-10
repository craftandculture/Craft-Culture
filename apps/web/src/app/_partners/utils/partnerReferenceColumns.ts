import { sql } from 'drizzle-orm';

import db from '@/database/client';

/** A table and column pointing at partners.id */
export interface PartnerReference {
  table: string;
  column: string;
}

/** Postgres identifiers, as Postgres itself writes them */
export const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/**
 * Every column in the database pointing at `partners.id`, asked of Postgres
 *
 * There are over forty of them and the set grows with the schema, so a
 * hard-coded list goes stale silently — and code that acts on a stale list
 * leaves rows pointing at a record nothing else uses, which is worse than not
 * acting at all because it looks done.
 *
 * Shared by the merge (which repoints these) and the duplicate finder (which
 * asks whether a retired record still holds any), so the two agree on what
 * "holds something" means rather than answering it twice.
 *
 * @returns Table/column pairs, filtered to identifiers safe to interpolate
 */
const partnerReferenceColumns = async (): Promise<PartnerReference[]> => {
  const references = await db.execute<{
    table_name: string;
    column_name: string;
  }>(sql`
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

  return [...references]
    .map((r) => ({ table: r.table_name, column: r.column_name }))
    .filter(
      (r) =>
        SAFE_IDENTIFIER.test(r.table) &&
        SAFE_IDENTIFIER.test(r.column) &&
        r.table !== 'partners',
    );
};

export default partnerReferenceColumns;
