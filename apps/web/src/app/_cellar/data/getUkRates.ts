import { desc } from 'drizzle-orm';

import db from '@/database/client';
import { cellarUkRates } from '@/database/schema';
import logger from '@/utils/logger';

/**
 * The UK rates in force on a day, and every version, newest first
 *
 * Never throws: until the table exists, or before anyone has entered LCB's
 * prices, there is simply no card, and UK charges show as not yet set.
 *
 * @param on - The day the rates should apply to (today by default)
 * @returns The current card, or null, and the history
 */
const getUkRates = async (on: Date = new Date()) => {
  try {
    const history = await db.select().from(cellarUkRates).orderBy(desc(cellarUkRates.effectiveFrom));
    const current = history.find((row) => row.effectiveFrom <= on) ?? null;
    return { current, history };
  } catch (error) {
    logger.error('Could not read the UK rate card', { error });
    return { current: null, history: [] as (typeof cellarUkRates.$inferSelect)[] };
  }
};


export default getUkRates;
