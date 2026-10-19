import { sql } from 'drizzle-orm';

import db from '@/database/client';
import logger from '@/utils/logger';

let known = false;

/**
 * Make sure cellar_uk_holdings has its supplier_name column, and say if it does
 *
 * Added in October 2026. The migration runs after the build and can quietly
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
    const [row] = await db.execute<{ present: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cellar_uk_holdings' AND column_name = 'supplier_name'
      ) AS present
    `);
    known = Boolean(row?.present);
  } catch (error) {
    logger.error('[UK bond] Could not prepare cellar_uk_holdings.supplier_name', { error });
    known = false;
  }

  return known;
};

export default hasUkSupplierColumn;
