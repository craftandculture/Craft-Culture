import { desc, like } from 'drizzle-orm';

import db from '@/database/client';
import { wmsCycleCounts } from '@/database/schema';

/**
 * Generate a unique count number for WMS cycle counts
 *
 * @example
 *   await generateCountNumber(); // returns 'CC-2026-0001'
 *
 * @returns The generated count number in format CC-YYYY-NNNN
 */
const generateCountNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `CC-${year}-`;

  const result = await db
    .select({ countNumber: wmsCycleCounts.countNumber })
    .from(wmsCycleCounts)
    .where(like(wmsCycleCounts.countNumber, `${prefix}%`))
    .orderBy(desc(wmsCycleCounts.countNumber))
    .limit(1);

  let nextSequence = 1;

  if (result.length > 0 && result[0]) {
    const lastNumber = result[0].countNumber;
    const lastSequence = parseInt(lastNumber.replace(prefix, ''), 10);
    nextSequence = lastSequence + 1;
  }

  return `${prefix}${nextSequence.toString().padStart(4, '0')}`;
};

export default generateCountNumber;
