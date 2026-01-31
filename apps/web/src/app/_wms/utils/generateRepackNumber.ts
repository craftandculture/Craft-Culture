import { like } from 'drizzle-orm';

import db from '@/database/client';
import { wmsRepacks } from '@/database/schema';

/**
 * Generate a unique repack number for WMS repacking operations
 *
 * @example
 *   await generateRepackNumber(); // returns 'RPK-2026-0001'
 *
 * @returns The generated repack number in format RPK-YYYY-NNNN
 */
const generateRepackNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `RPK-${year}-`;

  // Get the highest sequence number for this year
  const result = await db
    .select({ repackNumber: wmsRepacks.repackNumber })
    .from(wmsRepacks)
    .where(like(wmsRepacks.repackNumber, `${prefix}%`))
    .orderBy(wmsRepacks.repackNumber)
    .limit(1);

  let nextSequence = 1;

  if (result.length > 0 && result[0]) {
    const lastNumber = result[0].repackNumber;
    const lastSequence = parseInt(lastNumber.replace(prefix, ''), 10);
    nextSequence = lastSequence + 1;
  }

  return `${prefix}${nextSequence.toString().padStart(4, '0')}`;
};

export default generateRepackNumber;
