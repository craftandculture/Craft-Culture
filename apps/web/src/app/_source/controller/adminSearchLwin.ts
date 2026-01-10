import { ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { lwinWines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const searchLwinSchema = z.object({
  query: z.string().min(2).max(100),
  limit: z.number().int().min(1).max(20).default(10),
});

/**
 * Search the LWIN wines database for autocomplete
 *
 * Uses trigram similarity for fuzzy matching when pg_trgm is available,
 * falls back to ILIKE pattern matching otherwise.
 *
 * @example
 *   const results = await trpcClient.source.admin.searchLwin.query({
 *     query: "opus one",
 *     limit: 10
 *   });
 */
const adminSearchLwin = adminProcedure
  .input(searchLwinSchema)
  .query(async ({ input }) => {
    const { query, limit } = input;

    // Clean the query
    const cleanQuery = query.trim();

    try {
      // Try trigram similarity search first (requires pg_trgm extension)
      const results = await db
        .select({
          lwin: lwinWines.lwin,
          displayName: lwinWines.displayName,
          producerName: lwinWines.producerName,
          wine: lwinWines.wine,
          country: lwinWines.country,
          region: lwinWines.region,
          subRegion: lwinWines.subRegion,
          colour: lwinWines.colour,
          type: lwinWines.type,
          vintageConfig: lwinWines.vintageConfig,
          similarity: sql<number>`similarity(${lwinWines.displayName}, ${cleanQuery})`,
        })
        .from(lwinWines)
        .where(
          sql`similarity(${lwinWines.displayName}, ${cleanQuery}) > 0.2`,
        )
        .orderBy(
          sql`similarity(${lwinWines.displayName}, ${cleanQuery}) DESC`,
        )
        .limit(limit);

      return results;
    } catch {
      // Fallback to ILIKE if pg_trgm not available
      const searchPattern = `%${cleanQuery.replace(/\s+/g, '%')}%`;

      const results = await db
        .select({
          lwin: lwinWines.lwin,
          displayName: lwinWines.displayName,
          producerName: lwinWines.producerName,
          wine: lwinWines.wine,
          country: lwinWines.country,
          region: lwinWines.region,
          subRegion: lwinWines.subRegion,
          colour: lwinWines.colour,
          type: lwinWines.type,
          vintageConfig: lwinWines.vintageConfig,
        })
        .from(lwinWines)
        .where(
          or(
            ilike(lwinWines.displayName, searchPattern),
            ilike(lwinWines.producerName, searchPattern),
            ilike(lwinWines.wine, searchPattern),
          ),
        )
        .limit(limit);

      // Add a placeholder similarity score for fallback results
      return results.map((r) => ({ ...r, similarity: 0.5 }));
    }
  });

export default adminSearchLwin;
