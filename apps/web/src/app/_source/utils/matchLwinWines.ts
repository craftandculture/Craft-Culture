import { and, eq, ilike, sql } from 'drizzle-orm';

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
 * Strategy (in order):
 * 1. Exact keyword match on displayName — all keywords must appear
 * 2. Fuzzy trigram fallback — only if step 1 finds nothing
 *
 * Always picks the shortest displayName (most generic match).
 * We search displayName (which is "Producer, Wine") rather than the wine column
 * because some entries have wine=NULL (e.g., "Dom Perignon" where the producer IS the wine).
 */
const matchSingleItem = async (
  item: ParsedItem,
): Promise<LwinMatch | null> => {
  if (item.lwin) {
    return null;
  }

  // Use raw product name keywords (don't strip producer — displayName includes producer)
  const cleanedName = item.productName.replace(/\b(19|20)\d{2}\b/g, '').trim();
  const fillers = new Set(['the', 'de', 'du', 'des', 'le', 'la', 'les', 'di', 'del', 'and', '&', '-', ',', '.']);
  const allKeywords = cleanedName
    .split(/[\s,]+/)
    .map((w) => w.replace(/[^a-zA-Z0-9À-ÿ]/g, '').trim())
    .filter((w) => w.length >= 2 && !fillers.has(w.toLowerCase()));

  if (allKeywords.length === 0) {
    return null;
  }

  const selectFields = {
    lwin: lwinWines.lwin,
    displayName: lwinWines.displayName,
    producerName: lwinWines.producerName,
    wine: lwinWines.wine,
    country: lwinWines.country,
    region: lwinWines.region,
  };

  // --- Step 1: Exact keyword match on displayName ---
  // displayName is "Producer, Wine" so it's the most reliable single field.
  // All keywords must appear. Sorted by shortest displayName (most generic match).
  const displayConditions = allKeywords.map((kw) => ilike(lwinWines.displayName, `%${kw}%`));

  const displayResults = await db
    .select(selectFields)
    .from(lwinWines)
    .where(
      and(
        ...displayConditions,
        eq(lwinWines.status, 'live'),
      ),
    )
    .orderBy(sql`length(${lwinWines.displayName}) ASC`)
    .limit(10);

  if (displayResults.length > 0) {
    const match = displayResults[0]!;
    return { ...match, similarity: 1.0 };
  }

  // --- Step 2: Fuzzy trigram fallback ---
  // Only used when exact keyword matching finds nothing (handles typos, alternate spellings)
  const searchQuery = [item.producer, ...allKeywords].filter(Boolean).join(' ');

  try {
    const fuzzyResults = await db
      .select({
        ...selectFields,
        similarity: sql<number>`similarity(${lwinWines.displayName}, ${searchQuery})`,
      })
      .from(lwinWines)
      .where(
        and(
          sql`similarity(${lwinWines.displayName}, ${searchQuery}) > 0.3`,
          eq(lwinWines.status, 'live'),
        ),
      )
      .orderBy(
        sql`similarity(${lwinWines.displayName}, ${searchQuery}) DESC`,
        sql`length(${lwinWines.displayName}) ASC`,
      )
      .limit(5);

    if (fuzzyResults.length > 0) {
      const match = fuzzyResults[0]!;
      return match;
    }
  } catch (error) {
    logger.dev('Trigram search failed', { error });
  }

  return null;
};

/**
 * Match parsed items to the LWIN database
 *
 * Attempts to find LWIN codes for each parsed item using exact keyword
 * matching first, then fuzzy matching as a fallback. Items that already
 * have an LWIN code are skipped.
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
      matchedItems.push(item);
      continue;
    }

    const match = await matchSingleItem(item);

    if (match && match.similarity >= 0.4) {
      matchedItems.push({
        ...item,
        lwin: match.lwin,
        country: item.country || match.country || undefined,
        region: item.region || match.region || undefined,
      });
      matchCount++;
      logger.dev(`LWIN match: "${item.productName}" → ${match.lwin} "${match.displayName}" (${(match.similarity * 100).toFixed(0)}%)`, {
        displayName: match.displayName,
      });
    } else {
      matchedItems.push(item);
      logger.dev(`LWIN no match: "${item.productName}"`, {
        similarity: match?.similarity,
      });
    }
  }

  logger.dev(`LWIN matching complete: ${matchCount}/${items.length} items matched`);

  return matchedItems;
};

export default matchLwinWines;
