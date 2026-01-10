import { sql } from 'drizzle-orm';

import db from '@/database/client';
import { lwinWines } from '@/database/schema';
import logger from '@/utils/logger';

interface ParsedItem {
  productName: string;
  producer?: string;
  vintage?: string;
  region?: string;
  country?: string;
  lwin?: string;
}

interface LwinMatch {
  lwin: string;
  displayName: string;
  producerName: string | null;
  wine: string | null;
  country: string | null;
  region: string | null;
  similarity: number;
}

/**
 * Match a single parsed item to the LWIN database
 *
 * Uses trigram similarity matching to find the best LWIN match based on
 * producer name and wine/product name.
 */
const matchSingleItem = async (
  item: ParsedItem,
): Promise<LwinMatch | null> => {
  // Skip if already has LWIN
  if (item.lwin) {
    return null;
  }

  // Build search terms
  const searchTerms: string[] = [];

  if (item.producer) {
    searchTerms.push(item.producer);
  }

  if (item.productName) {
    // Remove vintage from product name for better matching
    const nameWithoutVintage = item.productName
      .replace(/\b(19|20)\d{2}\b/g, '')
      .trim();
    searchTerms.push(nameWithoutVintage);
  }

  if (searchTerms.length === 0) {
    return null;
  }

  const searchQuery = searchTerms.join(' ');

  try {
    // Use trigram similarity for fuzzy matching
    // pg_trgm extension must be enabled
    const results = await db
      .select({
        lwin: lwinWines.lwin,
        displayName: lwinWines.displayName,
        producerName: lwinWines.producerName,
        wine: lwinWines.wine,
        country: lwinWines.country,
        region: lwinWines.region,
        similarity: sql<number>`similarity(${lwinWines.displayName}, ${searchQuery})`,
      })
      .from(lwinWines)
      .where(
        sql`similarity(${lwinWines.displayName}, ${searchQuery}) > 0.3`,
      )
      .orderBy(
        sql`similarity(${lwinWines.displayName}, ${searchQuery}) DESC`,
      )
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const match = results[0];
    if (!match) {
      return null;
    }

    return {
      lwin: match.lwin,
      displayName: match.displayName,
      producerName: match.producerName,
      wine: match.wine,
      country: match.country,
      region: match.region,
      similarity: match.similarity,
    };
  } catch (error) {
    // If pg_trgm extension is not available, fall back to basic search
    logger.dev('Trigram search failed, falling back to ILIKE', { error });

    try {
      const searchPattern = `%${searchQuery.replace(/\s+/g, '%')}%`;

      const results = await db
        .select({
          lwin: lwinWines.lwin,
          displayName: lwinWines.displayName,
          producerName: lwinWines.producerName,
          wine: lwinWines.wine,
          country: lwinWines.country,
          region: lwinWines.region,
        })
        .from(lwinWines)
        .where(sql`${lwinWines.displayName} ILIKE ${searchPattern}`)
        .limit(1);

      if (results.length === 0) {
        return null;
      }

      const match = results[0];
      if (!match) {
        return null;
      }

      return {
        lwin: match.lwin,
        displayName: match.displayName,
        producerName: match.producerName,
        wine: match.wine,
        country: match.country,
        region: match.region,
        similarity: 0.5, // Approximate similarity for fallback
      };
    } catch {
      return null;
    }
  }
};

/**
 * Match parsed items to the LWIN database
 *
 * Attempts to find LWIN codes for each parsed item using fuzzy matching.
 * Items that already have an LWIN code are skipped.
 *
 * @param items - Array of parsed wine items
 * @returns Array of items with LWIN codes filled in where matches were found
 */
const matchLwinWines = async <
  T extends ParsedItem,
>(items: T[]): Promise<T[]> => {
  const matchedItems: T[] = [];
  let matchCount = 0;

  for (const item of items) {
    if (item.lwin) {
      // Already has LWIN, keep as-is
      matchedItems.push(item);
      continue;
    }

    const match = await matchSingleItem(item);

    if (match && match.similarity >= 0.4) {
      matchedItems.push({
        ...item,
        lwin: match.lwin,
        // Optionally fill in missing fields from LWIN data
        country: item.country || match.country || undefined,
        region: item.region || match.region || undefined,
      });
      matchCount++;
      logger.dev(`LWIN match found: "${item.productName}" → ${match.lwin} (${(match.similarity * 100).toFixed(0)}%)`, {
        displayName: match.displayName,
      });
    } else {
      matchedItems.push(item);
    }
  }

  logger.dev(`LWIN matching complete: ${matchCount}/${items.length} items matched`);

  return matchedItems;
};

export default matchLwinWines;
