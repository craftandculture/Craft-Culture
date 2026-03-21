import { and, eq, gt, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsStock } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

const extractedItemSchema = z.object({
  productName: z.string(),
  producer: z.string().optional(),
  vintage: z.string().optional(),
  region: z.string().optional(),
  quantity: z.number(),
  unitPrice: z.number().optional(),
  total: z.number().optional(),
});

const matchInputSchema = z.object({
  extractedItems: z.array(extractedItemSchema),
});

interface WmsMatch {
  lwin18: string;
  productName: string;
  producer: string | null;
  vintage: number | null;
  bottleSize: string;
  caseConfig: number | null;
  availableCases: number;
}

interface MatchResult {
  extractedIndex: number;
  matched: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  wmsItem?: WmsMatch;
  extracted: z.infer<typeof extractedItemSchema>;
}

/**
 * Match extracted invoice items against WMS warehouse stock.
 *
 * Searches wmsStock (filtered by partner's ownerId) for matches based on
 * product name, producer, and vintage. Returns matched WMS items with
 * available case counts.
 */
const matchExtractedToLocalStock = winePartnerProcedure
  .input(matchInputSchema)
  .mutation(async ({ ctx, input }) => {
    const { extractedItems } = input;
    const { partnerId } = ctx;
    const results: MatchResult[] = [];

    for (let i = 0; i < extractedItems.length; i++) {
      const item = extractedItems[i];
      if (!item) continue;

      const result: MatchResult = {
        extractedIndex: i,
        matched: false,
        confidence: 'none',
        extracted: item,
      };

      // Build search conditions
      const searchConditions = [];

      // Parse vintage from extracted data
      const vintageYear = item.vintage ? parseInt(item.vintage, 10) : null;
      const hasVintage = vintageYear && !isNaN(vintageYear) && vintageYear > 1900;

      // Normalize product name for matching
      const normalizedName = item.productName
        .toLowerCase()
        .replace(/[,.'"`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Split name into parts for flexible matching
      const nameParts = normalizedName.split(' ').filter((p) => p.length > 2);

      // Build name matching conditions
      if (item.productName) {
        searchConditions.push(ilike(wmsStock.productName, `%${item.productName}%`));

        if (item.producer) {
          searchConditions.push(
            and(
              ilike(wmsStock.productName, `%${item.productName}%`),
              ilike(wmsStock.producer, `%${item.producer}%`),
            ),
          );
        }
      }

      // Partial matching on keywords
      if (nameParts.length >= 2) {
        const keyWords = nameParts.slice(0, 3);
        const keyWordConditions = keyWords.map((word) => ilike(wmsStock.productName, `%${word}%`));
        if (keyWordConditions.length > 1) {
          searchConditions.push(and(...keyWordConditions));
        }
      }

      if (searchConditions.length === 0) {
        results.push(result);
        continue;
      }

      // Search WMS stock grouped by LWIN18+caseConfig for this partner
      const matches = await db
        .select({
          lwin18: wmsStock.lwin18,
          productName: sql<string>`MIN(${wmsStock.productName})`.as('product_name'),
          producer: sql<string | null>`MIN(${wmsStock.producer})`.as('producer'),
          vintage: sql<number | null>`MIN(${wmsStock.vintage})`.as('vintage'),
          bottleSize: sql<string>`MIN(${wmsStock.bottleSize})`.as('bottle_size'),
          caseConfig: wmsStock.caseConfig,
          availableCases: sql<number>`SUM(${wmsStock.availableCases})`.as('available_cases'),
        })
        .from(wmsStock)
        .where(
          and(
            eq(wmsStock.ownerId, partnerId),
            or(...searchConditions),
          ),
        )
        .groupBy(wmsStock.lwin18, wmsStock.caseConfig)
        .having(gt(sql`SUM(${wmsStock.availableCases})`, 0))
        .limit(10);

      if (matches.length > 0) {
        const firstMatch = matches[0];
        if (!firstMatch) {
          results.push(result);
          continue;
        }

        let bestMatch = firstMatch;
        let bestScore = 0;

        for (const match of matches) {
          let score = 0;

          // Score based on name similarity
          const productName = match.productName.toLowerCase();
          if (productName === normalizedName) {
            score += 100;
          } else if (productName.includes(normalizedName)) {
            score += 80;
          } else {
            const matchingWords = nameParts.filter((p) => productName.includes(p));
            score += matchingWords.length * 20;
          }

          // Score based on vintage match
          if (hasVintage && match.vintage) {
            if (match.vintage === vintageYear) {
              score += 50;
            } else if (Math.abs(match.vintage - vintageYear) <= 1) {
              score += 20;
            }
          }

          // Score based on producer match
          if (item.producer && match.producer) {
            const prodNormalized = item.producer.toLowerCase();
            const matchProducer = match.producer.toLowerCase();
            if (matchProducer.includes(prodNormalized) || prodNormalized.includes(matchProducer)) {
              score += 30;
            }
          }

          // Prefer items with sufficient stock
          if (match.availableCases >= item.quantity) {
            score += 10;
          }

          if (score > bestScore) {
            bestScore = score;
            bestMatch = match;
          }
        }

        // Determine confidence level
        let confidence: 'high' | 'medium' | 'low' = 'low';
        if (bestScore >= 120) {
          confidence = 'high';
        } else if (bestScore >= 70) {
          confidence = 'medium';
        }

        result.matched = true;
        result.confidence = confidence;
        result.wmsItem = {
          lwin18: bestMatch.lwin18,
          productName: bestMatch.productName,
          producer: bestMatch.producer,
          vintage: bestMatch.vintage,
          bottleSize: bestMatch.bottleSize,
          caseConfig: bestMatch.caseConfig,
          availableCases: bestMatch.availableCases,
        };
      }

      results.push(result);
    }

    // Summary stats
    const matchedCount = results.filter((r) => r.matched).length;
    const highConfidenceCount = results.filter((r) => r.confidence === 'high').length;

    return {
      results,
      summary: {
        total: extractedItems.length,
        matched: matchedCount,
        highConfidence: highConfidenceCount,
        unmatched: extractedItems.length - matchedCount,
      },
    };
  });

export default matchExtractedToLocalStock;
