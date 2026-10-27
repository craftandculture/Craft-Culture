import { and, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { lwinWines } from '@/database/schema';
import { collectorProcedure } from '@/lib/trpc/procedures';

/**
 * Find a wine by name or producer, for asking us to source it
 *
 * Picking the wine from the LWIN list means the team knows exactly which wine
 * is meant; a member who cannot find it can still type the name.
 *
 * @example
 *   await trpcClient.cellarSourcing.member.searchWines.query({ query: 'rousseau chambertin' });
 */
const memberSearchWines = collectorProcedure
  .input(z.object({ query: z.string().trim().min(2).max(100) }))
  .query(async ({ input }) => {
    const terms = input.query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length >= 2)
      .slice(0, 6);

    if (terms.length === 0) return { wines: [] };

    const wines = await db
      .select({
        lwin: lwinWines.lwin,
        displayName: lwinWines.displayName,
        region: lwinWines.region,
        country: lwinWines.country,
      })
      .from(lwinWines)
      .where(
        and(
          eq(lwinWines.status, 'live'),
          ...terms.map((term) =>
            or(
              ilike(lwinWines.displayName, `%${term}%`),
              ilike(lwinWines.producerName, `%${term}%`),
            ),
          ),
        ),
      )
      .orderBy(lwinWines.displayName)
      .limit(8);

    return { wines };
  });

export default memberSearchWines;
