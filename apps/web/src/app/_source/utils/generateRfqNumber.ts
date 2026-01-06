import { desc, sql } from 'drizzle-orm';

import db from '@/database/client';
import { sourceRfqs } from '@/database/schema';

/**
 * Generate a unique RFQ number in format SRC-YYYY-NNNN
 *
 * @example
 *   await generateRfqNumber(); // returns "SRC-2026-0001"
 */
const generateRfqNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `SRC-${year}-`;

  // Get the latest RFQ number for this year
  const [latest] = await db
    .select({ rfqNumber: sourceRfqs.rfqNumber })
    .from(sourceRfqs)
    .where(sql`${sourceRfqs.rfqNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(sourceRfqs.rfqNumber))
    .limit(1);

  let nextNumber = 1;

  if (latest?.rfqNumber) {
    const match = latest.rfqNumber.match(/SRC-\d{4}-(\d{4})/);
    if (match?.[1]) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

export default generateRfqNumber;
