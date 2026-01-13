import { desc, sql } from 'drizzle-orm';

import db from '@/database/client';
import { sourceCustomerPos } from '@/database/schema';

/**
 * Generate a unique Customer PO number in format CPO-YYYY-NNNN
 *
 * @example
 *   await generateCpoNumber(); // returns "CPO-2026-0001"
 */
const generateCpoNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `CPO-${year}-`;

  // Get the latest CPO number for this year
  const [latest] = await db
    .select({ ccPoNumber: sourceCustomerPos.ccPoNumber })
    .from(sourceCustomerPos)
    .where(sql`${sourceCustomerPos.ccPoNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(sourceCustomerPos.ccPoNumber))
    .limit(1);

  let nextNumber = 1;

  if (latest?.ccPoNumber) {
    const match = latest.ccPoNumber.match(/CPO-\d{4}-(\d{4})/);
    if (match?.[1]) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

export default generateCpoNumber;
