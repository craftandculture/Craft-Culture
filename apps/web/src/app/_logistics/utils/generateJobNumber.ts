import { desc, like } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsJobs } from '@/database/schema';

const PREFIX = { export: 'EXP-CNC', import: 'IMP-CNC' } as const;

/**
 * The next job number for the year, e.g. EXP-CNC/26/0001
 *
 * Imports and exports count separately and start again at 0001 each year. The
 * column is unique, so two jobs made at the same moment cannot share a number;
 * the second insert fails and is retried by the caller.
 *
 * @example
 *   await generateJobNumber('export'); // 'EXP-CNC/26/0001'
 *
 * @param kind - Which count to take the number from
 * @param now - The moment to date it by (Dubai year)
 */
const generateJobNumber = async (kind: keyof typeof PREFIX, now = new Date()) => {
  const year = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', year: '2-digit' }).format(now);
  const stem = `${PREFIX[kind]}/${year}/`;

  // Fixed-width numbers, so the highest sorts last
  const [latest] = await db
    .select({ jobNumber: logisticsJobs.jobNumber })
    .from(logisticsJobs)
    .where(like(logisticsJobs.jobNumber, `${stem}%`))
    .orderBy(desc(logisticsJobs.jobNumber))
    .limit(1);

  const last = latest ? parseInt(latest.jobNumber.slice(stem.length), 10) : 0;

  return `${stem}${String((Number.isFinite(last) ? last : 0) + 1).padStart(4, '0')}`;
};

export default generateJobNumber;
