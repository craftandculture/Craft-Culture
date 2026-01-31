import { desc, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsDispatchBatches } from '@/database/schema';

/**
 * Generate a unique batch number in format: BATCH-YYYY-NNNN
 * Example: BATCH-2026-0001
 *
 * @returns The generated batch number
 */
const generateBatchNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `BATCH-${year}-`;

  // Get the last batch number for this year
  const [lastBatch] = await db
    .select({ batchNumber: wmsDispatchBatches.batchNumber })
    .from(wmsDispatchBatches)
    .where(sql`${wmsDispatchBatches.batchNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(wmsDispatchBatches.batchNumber))
    .limit(1);

  let sequence = 1;

  if (lastBatch?.batchNumber) {
    const lastSequence = parseInt(lastBatch.batchNumber.split('-')[2] ?? '0', 10);
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, '0')}`;
};

export default generateBatchNumber;
