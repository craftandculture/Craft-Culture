import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { lwinWines } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';
import matchToLwin from '@/lib/winelabs/matchToLwin';

/**
 * Ask Wine Labs which LWIN a wine name is, before a code is given to it
 *
 * For a wine arriving without an LWIN, where our own register search finds
 * nothing or too much. One name search, about 8 credits, so it runs on a
 * click, never as someone types. The answer is a suggestion: it is shown
 * with the register's own name for that code so staff can see it is the
 * right cuvée before using it. C&C staff only while the licence is open.
 */
const adminSuggestLwin = teamProcedure
  .input(z.object({ query: z.string().trim().min(3).max(200) }))
  .mutation(async ({ input }) => {
    let match;
    try {
      match = await matchToLwin(input.query);
    } catch (error) {
      throw new TRPCError({
        code: 'BAD_GATEWAY',
        message: error instanceof Error ? error.message : 'Wine Labs did not answer.',
      });
    }
    if (!match?.lwin7) return null;

    const [wine] = await db
      .select({
        lwin: lwinWines.lwin,
        displayName: lwinWines.displayName,
        producerName: lwinWines.producerName,
        country: lwinWines.country,
        region: lwinWines.region,
        colour: lwinWines.colour,
        type: lwinWines.type,
        classification: lwinWines.classification,
      })
      .from(lwinWines)
      .where(eq(lwinWines.lwin, match.lwin7));

    return {
      wine: wine ?? null,
      lwin7: match.lwin7,
      winelabsName: match.displayName ?? null,
    };
  });

export default adminSuggestLwin;
