import { gte, sql } from 'drizzle-orm';

import db from '@/database/client';
import { winelabsCalls } from '@/database/schema';

/**
 * Credits spent on Wine Labs since the start of this calendar month (UTC)
 *
 * @returns The credits logged this month
 */
const getWinelabsCreditsThisMonth = async () => {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [row] = await db
    .select({ credits: sql<number>`coalesce(sum(${winelabsCalls.credits}), 0)::int` })
    .from(winelabsCalls)
    .where(gte(winelabsCalls.createdAt, monthStart));

  return row?.credits ?? 0;
};

export default getWinelabsCreditsThisMonth;
