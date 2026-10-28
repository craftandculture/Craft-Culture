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
 * Each row is answered for its own bottle size: a magnum is priced as a
 * magnum, not as twice a bottle. C&C staff only while the Wine Labs licence is open.
 */
const getLondonInBond = teamProcedure
  .input(z.object({ lwin18s: z.array(z.string()).max(1000) }))
  .query(async ({ input }) => {
    const keyByLwin18 = new Map<string, { lwin11: string; key: string }>();
    for (const lwin18 of input.lwin18s) {
      const code = lwin11Of(lwin18);
      if (code) keyByLwin18.set(lwin18, { lwin11: code.lwin11, key: `${code.lwin11}:${code.format}` });
    }
    if (keyByLwin18.size === 0) return { prices: {} };

    const rows = await db
      .select()
      .from(winelabsMarket)
      .where(
        and(
          inArray(winelabsMarket.lwin11, [...new Set([...keyByLwin18.values()].map(({ lwin11 }) => lwin11))]),
          eq(winelabsMarket.status, 'priced'),
        ),
      );
    const byKey = new Map(rows.map((row) => [`${row.lwin11}:${row.format}`, row]));

    const prices: Record<
      string,
      Pick<(typeof rows)[number], 'bidUsd' | 'askUsd' | 'lastUsd' | 'lastTradedAt' | 'venues' | 'checkedAt'>
    > = {};
    for (const [lwin18, { key }] of keyByLwin18) {
      const row = byKey.get(key);
      if (row) {
        const { bidUsd, askUsd, lastUsd, lastTradedAt, venues, checkedAt } = row;
        prices[lwin18] = { bidUsd, askUsd, lastUsd, lastTradedAt, venues, checkedAt };
      }
    }

    return { prices };
  });

export default getLondonInBond;
