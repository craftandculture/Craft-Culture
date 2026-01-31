import { desc, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsPickLists } from '@/database/schema';

/**
 * Generate a unique pick list number in format: PL-YYYY-NNNN
 * Example: PL-2026-0001
 *
 * @returns The generated pick list number
 */
const generatePickListNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `PL-${year}-`;

  // Get the last pick list number for this year
  const [lastPickList] = await db
    .select({ pickListNumber: wmsPickLists.pickListNumber })
    .from(wmsPickLists)
    .where(sql`${wmsPickLists.pickListNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(wmsPickLists.pickListNumber))
    .limit(1);

  let sequence = 1;

  if (lastPickList?.pickListNumber) {
    const lastSequence = parseInt(lastPickList.pickListNumber.split('-')[2] ?? '0', 10);
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, '0')}`;
};

export default generatePickListNumber;
