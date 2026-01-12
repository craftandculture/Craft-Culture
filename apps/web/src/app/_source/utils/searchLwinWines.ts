import { and, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { lwinWines } from '@/database/schema';

interface SearchResult {
  lwin: string;
  displayName: string;
  producerName: string | null;
  wine: string | null;
  country: string | null;
  region: string | null;
  subRegion: string | null;
  colour: string | null;
  type: string | null;
  firstVintage: string | null;
  finalVintage: string | null;
  similarity: number;
}

interface SearchOptions {
  limit?: number;
  minSimilarity?: number;
  country?: string;
  region?: string;
  colour?: string;
}

/**
 * Search the LWIN wines database by name
 *
 * Uses trigram similarity for fuzzy matching. Returns multiple results
 * sorted by similarity score for manual selection.
 *
 * @example
 *   const results = await searchLwinWines('Chateau Margaux');
 *   // Returns matches like:
 *   // [{ lwin: '1002285', displayName: 'Château Margaux', similarity: 0.95 }, ...]
 */
const searchLwinWines = async (
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> => {
  const {
    limit = 20,
    minSimilarity = 0.2,
    country,
    region,
    colour,
  } = options;

  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchQuery = query.trim();

  try {
    // Build filter conditions
    const conditions = [
      sql`similarity(${lwinWines.displayName}, ${searchQuery}) > ${minSimilarity}`,
      eq(lwinWines.status, 'live'),
    ];

    if (country) {
      conditions.push(sql`${lwinWines.country} ILIKE ${`%${country}%`}`);
    }

    if (region) {
      conditions.push(sql`${lwinWines.region} ILIKE ${`%${region}%`}`);
    }

    if (colour) {
      conditions.push(eq(lwinWines.colour, colour as 'red' | 'white' | 'rose' | 'amber' | 'orange' | 'mixed'));
    }

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
        firstVintage: lwinWines.firstVintage,
        finalVintage: lwinWines.finalVintage,
        similarity: sql<number>`similarity(${lwinWines.displayName}, ${searchQuery})`,
      })
      .from(lwinWines)
      .where(and(...conditions))
      .orderBy(
        sql`similarity(${lwinWines.displayName}, ${searchQuery}) DESC`,
      )
      .limit(limit);

    return results;
  } catch {
    // Fallback to ILIKE search if trigram fails (extension not available)
    const searchPattern = `%${searchQuery.replace(/\s+/g, '%')}%`;

    const conditions = [
      sql`${lwinWines.displayName} ILIKE ${searchPattern}`,
      eq(lwinWines.status, 'live'),
    ];

    if (country) {
      conditions.push(sql`${lwinWines.country} ILIKE ${`%${country}%`}`);
    }

    if (region) {
      conditions.push(sql`${lwinWines.region} ILIKE ${`%${region}%`}`);
    }

    if (colour) {
      conditions.push(eq(lwinWines.colour, colour as 'red' | 'white' | 'rose' | 'amber' | 'orange' | 'mixed'));
    }

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
        firstVintage: lwinWines.firstVintage,
        finalVintage: lwinWines.finalVintage,
      })
      .from(lwinWines)
      .where(and(...conditions))
      .limit(limit);

    // Return with approximate similarity
    return results.map((r) => ({ ...r, similarity: 0.5 }));
  }
};

export default searchLwinWines;
