/**
 * Search LWIN Database
 *
 * Searches the lwin_wines table (208k+ Liv-ex records) by:
 * - Producer name
 * - Wine name
 * - Display name (combined)
 * - Region/Country
 *
 * Returns matching wines with their LWIN7 codes for building LWIN18.
 */

import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { lwinWines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const searchSchema = z.object({
  query: z.string().min(2).max(100),
  country: z.string().optional(),
  region: z.string().optional(),
  colour: z.enum(['red', 'white', 'rose', 'amber']).optional(),
  limit: z.number().min(1).max(100).default(25),
});

const adminSearchLwin = adminProcedure
  .input(searchSchema)
  .query(async ({ input }) => {
    const { query, country, region, colour, limit } = input;

    // Build search conditions
    const searchTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length >= 2);

    // Create ILIKE conditions for each term against multiple fields
    const searchConditions = searchTerms.map((term) =>
      or(
        ilike(lwinWines.displayName, `%${term}%`),
        ilike(lwinWines.producerName, `%${term}%`),
        ilike(lwinWines.wine, `%${term}%`),
      ),
    );

    // Build filter conditions
    const filterConditions = [];
    if (country) {
      filterConditions.push(ilike(lwinWines.country, `%${country}%`));
    }
    if (region) {
      filterConditions.push(
        or(
          ilike(lwinWines.region, `%${region}%`),
          ilike(lwinWines.subRegion, `%${region}%`),
        ),
      );
    }
    if (colour) {
      filterConditions.push(eq(lwinWines.colour, colour));
    }

    // Only return live wines
    filterConditions.push(eq(lwinWines.status, 'live'));

    // Combine all conditions
    const whereClause = and(...searchConditions, ...filterConditions);

    // Execute search with ranking
    const results = await db
      .select({
        lwin: lwinWines.lwin,
        displayName: lwinWines.displayName,
        producerTitle: lwinWines.producerTitle,
        producerName: lwinWines.producerName,
        wine: lwinWines.wine,
        country: lwinWines.country,
        region: lwinWines.region,
        subRegion: lwinWines.subRegion,
        colour: lwinWines.colour,
        type: lwinWines.type,
        subType: lwinWines.subType,
        designation: lwinWines.designation,
        classification: lwinWines.classification,
        vintageConfig: lwinWines.vintageConfig,
      })
      .from(lwinWines)
      .where(whereClause)
      .orderBy(
        // Prioritize exact matches on producer name
        sql`CASE WHEN LOWER(${lwinWines.producerName}) = ${query.toLowerCase()} THEN 0 ELSE 1 END`,
        // Then by display name similarity
        sql`LENGTH(${lwinWines.displayName})`,
      )
      .limit(limit);

    return {
      results,
      count: results.length,
      query,
    };
  });

export default adminSearchLwin;
