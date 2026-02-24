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
 * Extract meaningful wine keywords from a product name
 *
 * Strips vintage, common filler words, and punctuation to get the core
 * wine identity for keyword matching.
 */
const extractWineKeywords = (productName: string, producer?: string) => {
  // Remove vintage years
  let cleaned = productName.replace(/\b(19|20)\d{2}\b/g, '').trim();

  // Remove producer name from product name if it's embedded (avoids double-matching)
  if (producer) {
    const producerLower = producer.toLowerCase();
    cleaned = cleaned
      .split(/\s+/)
      .filter((word) => !producerLower.includes(word.toLowerCase()) || word.length <= 2)
      .join(' ');
  }

  // Remove common filler words and punctuation
  const fillers = new Set(['the', 'de', 'du', 'des', 'le', 'la', 'les', 'di', 'del', 'and', '&', '-', ',', '.']);
  const keywords = cleaned
    .split(/[\s,]+/)
    .map((w) => w.replace(/[^a-zA-Z0-9À-ÿ]/g, '').trim())
    .filter((w) => w.length >= 2 && !fillers.has(w.toLowerCase()));

  return keywords;
};

/**
 * Match a single parsed item to the LWIN database
 *
 * Strategy (in order):
 * 1. Exact keyword match on the wine column — all wine keywords must appear
 * 2. Exact keyword match on displayName — all keywords must appear
 * 3. Fuzzy trigram fallback — only if steps 1-2 find nothing
 *
 * In all cases, picks the shortest displayName (most generic match).
 */
const matchSingleItem = async (
  item: ParsedItem,
): Promise<LwinMatch | null> => {
  if (item.lwin) {
    return null;
  }

  const wineKeywords = extractWineKeywords(item.productName, item.producer);
  if (wineKeywords.length === 0) {
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

  // --- Step 1: Exact keyword match on wine column ---
  // Every keyword must appear in the wine name (e.g., "Dom Perignon" + "P2")
  // This is the most precise match — the wine column is just the wine name without producer
  const wineConditions = wineKeywords.map((kw) => ilike(lwinWines.wine, `%${kw}%`));
  const producerCondition = item.producer
    ? ilike(lwinWines.producerName, `%${item.producer}%`)
    : undefined;

  const wineResults = await db
    .select(selectFields)
    .from(lwinWines)
    .where(
      and(
        ...wineConditions,
        ...(producerCondition ? [producerCondition] : []),
        eq(lwinWines.status, 'live'),
      ),
    )
    .orderBy(sql`length(${lwinWines.displayName}) ASC`)
    .limit(10);

  if (wineResults.length > 0) {
    const match = wineResults[0]!;
    return { ...match, similarity: 1.0 };
  }

  // --- Step 2: Exact keyword match on displayName ---
  // Broader — displayName includes producer, so "Moet & Chandon, Dom Perignon P2"
  const displayConditions = wineKeywords.map((kw) => ilike(lwinWines.displayName, `%${kw}%`));

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
    return { ...match, similarity: 0.9 };
  }

  // --- Step 3: Fuzzy trigram fallback ---
  // Only used when exact keyword matching finds nothing (handles typos, alternate spellings)
  const searchQuery = [item.producer, ...wineKeywords].filter(Boolean).join(' ');

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
