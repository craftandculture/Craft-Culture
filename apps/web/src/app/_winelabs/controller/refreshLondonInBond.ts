import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import priceWineInBond from '@/app/_winelabs/data/priceWineInBond';
import isInternalLwin from '@/app/_winelabs/utils/isInternalLwin';
import lwin11Of from '@/app/_winelabs/utils/lwin11Of';
import db from '@/database/client';
import { winelabsMarket } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';

/** A price asked for this recently is returned as it is, so a double click costs nothing */
const RECENT_MINUTES = 10;

/**
 * Ask Wine Labs for one wine's London in-bond market now
 *
 * For a price someone is about to quote on: the order book and the trades,
 * 15 to 30 credits. A price fetched in the last 10 minutes is returned without
 * asking again. C&C staff only while the Wine Labs licence is open.
 */
const refreshLondonInBond = teamProcedure
  .input(z.object({ lwin18: z.string().min(1) }))
  .mutation(async ({ input }) => {
    const code = lwin11Of(input.lwin18);
    if (!code || isInternalLwin(code.lwin7)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This wine has no LWIN the London exchanges know.' });
    }

    const [previous] = await db.select().from(winelabsMarket).where(eq(winelabsMarket.lwin11, code.lwin11));
    const recent =
      previous &&
      previous.status !== 'checking' &&
      previous.checkedAt.getTime() > Date.now() - RECENT_MINUTES * 60 * 1000 &&
      (previous.status === 'unlisted' || (previous.tradesCheckedAt?.getTime() ?? 0) >= previous.checkedAt.getTime());

    let row = previous;
    if (!recent) {
      try {
        row = await priceWineInBond(code, previous?.status === 'checking' ? undefined : previous, true);
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_GATEWAY',
          message: error instanceof Error ? error.message : 'Wine Labs did not answer.',
        });
      }
    }

    const { status, bidUsd, askUsd, lastUsd, lastTradedAt, venues, checkedAt } = row!;
    return { status, price: { bidUsd, askUsd, lastUsd, lastTradedAt, venues, checkedAt } };
  });

export default refreshLondonInBond;
