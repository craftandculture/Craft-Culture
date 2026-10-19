import { sql } from 'drizzle-orm';

import db from '@/database/client';
import logger from '@/utils/logger';

let known = false;

/**
 * Make sure cellar_uk_holdings has its October 2026 columns, and say if it does
 *
 * supplier_name, rotation_notes and gbp_value, added in October 2026. The migration runs after the build and can quietly
 * not run, and reading or writing a missing column would cost a member their
 * whole UK cellar or the team their import. So this adds it if it is absent,
 * the same way the pricing releases table heals itself, and callers leave the
 * supplier out when it still cannot be had.
 *
 * @returns True once the column exists
 */
const hasUkSupplierColumn = async () => {
  if (known) return true;

  try {
    await db.execute(
      sql`ALTER TABLE "cellar_uk_holdings" ADD COLUMN IF NOT EXISTS "supplier_name" text`,
    );
    await db.execute(
      sql`ALTER TABLE "cellar_uk_holdings" ADD COLUMN IF NOT EXISTS "rotation_notes" text`,
    );
    await db.execute(
      sql`ALTER TABLE "cellar_uk_holdings" ADD COLUMN IF NOT EXISTS "gbp_value" double precision`,
    );
    const [row] = await db.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM information_schema.columns
      WHERE table_name = 'cellar_uk_holdings'
        AND column_name IN ('supplier_name', 'rotation_notes', 'gbp_value')
    `);
    known = Number(row?.count ?? 0) === 3;
  } catch (error) {
    logger.error('[UK bond] Could not prepare cellar_uk_holdings.supplier_name', { error });
    known = false;
  }

  return known;
};

export default hasUkSupplierColumn;
