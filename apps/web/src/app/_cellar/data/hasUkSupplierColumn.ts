import { sql } from 'drizzle-orm';

import db from '@/database/client';
import logger from '@/utils/logger';

let known = false;

/**
 * Whether cellar_uk_holdings has its October 2026 columns
 *
 * supplier_name, rotation_notes and gbp_value, added in October 2026 by
 * scripts/migrate.mjs. The migration runs after the build and can quietly not
 * run, and reading or writing a missing column would cost a member their whole
 * UK cellar or the team their import, so callers leave those fields out until
 * the columns exist. Only read here: schema changes belong to the migration,
 * never to a member's page load.
 *
 * @returns True once the column exists
 */
const hasUkSupplierColumn = async () => {
  if (known) return true;

  try {
    const [row] = await db.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM information_schema.columns
      WHERE table_name = 'cellar_uk_holdings'
        AND column_name IN ('supplier_name', 'rotation_notes', 'gbp_value')
    `);
    known = Number(row?.count ?? 0) === 3;
  } catch (error) {
    logger.error('[UK bond] Could not check cellar_uk_holdings columns', { error });
    known = false;
  }

  return known;
};

export default hasUkSupplierColumn;
