import { desc, like } from 'drizzle-orm';

import db from '@/database/client';
import { poolSales } from '@/database/schema';

/**
 * Next pool-sale number for the year
 *
 * Max-plus-one, matching every other generator here, and not race-safe for the
 * same reason. See [generateMandateNumber] — the caller retries on the unique
 * constraint rather than losing the record.
 *
 * @example
 *   await generateSaleNumber(); // 'PSL-2026-0007'
 *
 * @returns A sequential, year-scoped sale reference
 */
const generateSaleNumber = async () => {
  const prefix = `PSL-${new Date().getFullYear()}-`;

  const [latest] = await db
    .select({ saleNumber: poolSales.saleNumber })
    .from(poolSales)
    .where(like(poolSales.saleNumber, `${prefix}%`))
    .orderBy(desc(poolSales.saleNumber))
    .limit(1);

  const next = latest
    ? parseInt(latest.saleNumber.replace(prefix, ''), 10) + 1
    : 1;

  return `${prefix}${String(next).padStart(4, '0')}`;
};

export default generateSaleNumber;
