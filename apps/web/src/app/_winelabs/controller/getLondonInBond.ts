import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import lwin11Of from '@/app/_winelabs/utils/lwin11Of';
import db from '@/database/client';
import { winelabsMarket } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

/**
 * London in-bond prices for the Pricing Manager's rows, from the snapshot
 *
 * Reads the cache only, never Wine Labs, so opening the page costs nothing.
 * Only 75cl rows are answered: the snapshot is per 75cl bottle, and a magnum
 * is not twice a bottle. C&C staff only while the Wine Labs licence is open.
 */
const getLondonInBond = teamProcedure
  .input(z.object({ lwin18s: z.array(z.string()).max(1000) }))
  .query(async ({ input }) => {
    const lwin11ByLwin18 = new Map<string, string>();
    for (const lwin18 of input.lwin18s) {
      const code = lwin11Of(lwin18);
      if (code && lwin18.replace(/-/g, '').endsWith('00750')) lwin11ByLwin18.set(lwin18, code.lwin11);
    }
    if (lwin11ByLwin18.size === 0) return { prices: {} };

    const rows = await db
      .select()
      .from(winelabsMarket)
      .where(
        and(inArray(winelabsMarket.lwin11, [...new Set(lwin11ByLwin18.values())]), eq(winelabsMarket.status, 'priced')),
      );
    const byLwin11 = new Map(rows.map((row) => [row.lwin11, row]));

    const prices: Record<
      string,
      Pick<(typeof rows)[number], 'bidUsd' | 'askUsd' | 'lastUsd' | 'lastTradedAt' | 'venues' | 'checkedAt'>
    > = {};
    for (const [lwin18, lwin11] of lwin11ByLwin18) {
      const row = byLwin11.get(lwin11);
      if (row) {
        const { bidUsd, askUsd, lastUsd, lastTradedAt, venues, checkedAt } = row;
        prices[lwin18] = { bidUsd, askUsd, lastUsd, lastTradedAt, venues, checkedAt };
      }
    }

    return { prices };
  });

export default getLondonInBond;
