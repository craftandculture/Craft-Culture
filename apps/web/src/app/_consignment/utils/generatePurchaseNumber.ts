import { desc, like } from 'drizzle-orm';

import db from '@/database/client';
import { cellarPurchases } from '@/database/schema';

/**
 * Next purchase number for the year
 *
 * Max-plus-one, like every other generator here, and not race-safe for the same
 * reason. The caller retries on the unique constraint.
 *
 * @example
 *   await generatePurchaseNumber(); // 'CPO-2026-0007'
 *
 * @returns A sequential, year-scoped purchase reference
 */
const generatePurchaseNumber = async () => {
  const prefix = `CPO-${new Date().getFullYear()}-`;

  const [latest] = await db
    .select({ purchaseNumber: cellarPurchases.purchaseNumber })
    .from(cellarPurchases)
    .where(like(cellarPurchases.purchaseNumber, `${prefix}%`))
    .orderBy(desc(cellarPurchases.purchaseNumber))
    .limit(1);

  const next = latest
    ? parseInt(latest.purchaseNumber.replace(prefix, ''), 10) + 1
    : 1;

  return `${prefix}${String(next).padStart(4, '0')}`;
};

export default generatePurchaseNumber;
