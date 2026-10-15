import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarMemberships } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { setExtraCaseQuantity } from '@/lib/zoho/billing';
import logger from '@/utils/logger';

import getStorageCharges from '../data/getStorageCharges';
import dubaiMonth from '../utils/dubaiMonth';

/**
 * Set each active member's extra-case add-on on Zoho for the coming renewal
 *
 * The quantity is in 6-bottle units (two per 12-bottle case), so the
 * CELLAR-EXTRA-CASE add-on must be priced at half the rate card's extra-case
 * price.
 *
 * Once per member per month — a second press skips anyone already pushed,
 * so it is safe to press again after a failure. Members on zero extra cases
 * are pushed too, clearing last month's quantity.
 */
const adminPushExtraCases = adminProcedure.mutation(async () => {
  const month = dubaiMonth();
  const rows = await getStorageCharges();

  const result = { pushed: [] as string[], skipped: [] as string[], failed: [] as string[] };

  for (const row of rows) {
    if (row.status !== 'active' || !row.zohoSubscriptionId) continue;
    if (row.lastPushedFor === month) {
      result.skipped.push(row.name);
      continue;
    }

    try {
      /*
        Zoho add-on quantities are whole numbers and storage comes in halves,
        so the add-on is a 6-bottle unit priced at half the extra-case rate
        (AED 4 at AED 8): a 12-bottle case is two of them.
      */
      await setExtraCaseQuantity(row.zohoSubscriptionId, Math.round(row.extraCases * 2));
      await db
        .update(cellarMemberships)
        .set({ lastExtraCasesPushedFor: month })
        .where(eq(cellarMemberships.id, row.membershipId));
      result.pushed.push(row.name);
    } catch (error) {
      logger.error('Could not push extra cases to Zoho', { error, membershipId: row.membershipId });
      result.failed.push(row.name);
    }
  }

  return { month, ...result };
});

export default adminPushExtraCases;
