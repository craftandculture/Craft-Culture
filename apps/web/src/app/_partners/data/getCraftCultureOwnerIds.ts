import { and, eq, ilike, ne, notIlike } from 'drizzle-orm';

import db from '@/database/client';
import { partners } from '@/database/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The partner records that are Craft & Culture itself, by id
 *
 * C&C is one partner record among many and has been merged and renamed, so it
 * is found by name — but only among active trade records. A private cellar is
 * named after the person who applied, so matching names alone let anyone
 * calling their cellar "Craft & Culture" be treated as us (their sales owed to
 * nobody, their stock sold first), and a retired record renamed "… (merged into
 * Craft & Culture)" matched too. Callers then compare ids, never names.
 *
 * @param executor - The database or a transaction
 * @returns The ids of C&C's own records
 */
const getCraftCultureOwnerIds = async (executor: Tx | typeof db = db) => {
  const rows = await executor
    .select({ id: partners.id })
    .from(partners)
    .where(
      and(
        ilike(partners.businessName, 'craft%culture%'),
        notIlike(partners.businessName, '%merged into%'),
        ne(partners.type, 'private_collector'),
        eq(partners.status, 'active'),
      ),
    );

  return new Set(rows.map((row) => row.id));
};

export default getCraftCultureOwnerIds;
