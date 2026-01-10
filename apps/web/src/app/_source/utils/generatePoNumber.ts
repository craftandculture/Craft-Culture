import { desc, sql } from 'drizzle-orm';

import db from '@/database/client';
import { sourcePurchaseOrders } from '@/database/schema';

/**
 * Generate a unique Purchase Order number in format PO-YYYY-NNNN
 *
 * @example
 *   await generatePoNumber(); // returns "PO-2026-0001"
 */
const generatePoNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;

  // Get the latest PO number for this year
  const [latest] = await db
    .select({ poNumber: sourcePurchaseOrders.poNumber })
    .from(sourcePurchaseOrders)
    .where(sql`${sourcePurchaseOrders.poNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(sourcePurchaseOrders.poNumber))
    .limit(1);

  let nextNumber = 1;

  if (latest?.poNumber) {
    const match = latest.poNumber.match(/PO-\d{4}-(\d{4})/);
    if (match?.[1]) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

export default generatePoNumber;
