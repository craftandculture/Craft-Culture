import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { productOffers, products } from '@/database/schema';
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

interface MatchResult {
  extractedIndex: number;
  matched: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  product?: {
    id: string;
    name: string;
    producer: string | null;
    year: number | null;
    region: string | null;
    country: string | null;
    lwin18: string;
  };
  offer?: {
    id: string;
    price: number | null;
    currency: string | null;
    unitSize: string | null;
    unitCount: number | null;
    availableQuantity: number;
  };
  extracted: z.infer<typeof extractedItemSchema>;
}

/**
 * Match extracted invoice items against local stock
 *
 * Searches the product catalog for matches based on product name, producer,
 * and vintage. Returns matched products with their local stock offers.
 * Only matches against local_inventory source (C&C warehouse stock).
 */
const matchExtractedToLocalStock = winePartnerProcedure
  .input(matchInputSchema)
  .mutation(async ({ input }) => {
    const { extractedItems } = input;
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

      // Parse vintage from extracted data (could be "2014" or "NV" etc)
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

      // Build name matching conditions - try exact first, then fuzzy
      if (item.productName) {
        // Exact match on full name
        searchConditions.push(ilike(products.name, `%${item.productName}%`));

        // Also try with producer if available
        if (item.producer) {
          searchConditions.push(
            and(
              ilike(products.name, `%${item.productName}%`),
              ilike(products.producer, `%${item.producer}%`),
            ),
          );
        }
      }

      // If we have significant name parts, also try partial matching
      if (nameParts.length >= 2) {
        // Try matching first 2-3 key words
        const keyWords = nameParts.slice(0, 3);
        const keyWordConditions = keyWords.map((word) => ilike(products.name, `%${word}%`));
        if (keyWordConditions.length > 1) {
          searchConditions.push(and(...keyWordConditions));
        }
      }

      // Search for matching products with local inventory offers
      const matches = await db
        .select({
          product: {
            id: products.id,
            name: products.name,
            producer: products.producer,
            year: products.year,
            region: products.region,
            country: products.country,
            lwin18: products.lwin18,
          },
          offer: {
            id: productOffers.id,
            price: productOffers.price,
            currency: productOffers.currency,
            unitSize: productOffers.unitSize,
            unitCount: productOffers.unitCount,
            availableQuantity: productOffers.availableQuantity,
          },
        })
        .from(products)
        .innerJoin(productOffers, eq(products.id, productOffers.productId))
        .where(
          and(
            // Must be local inventory
            eq(productOffers.source, 'local_inventory'),
            // Must have available quantity
            sql`${productOffers.availableQuantity} > 0`,
            // Match name criteria
            or(...searchConditions),
          ),
        )
        .limit(10);

      if (matches.length > 0) {
        // Score and rank matches
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
          const productName = match.product.name.toLowerCase();
          if (productName === normalizedName) {
            score += 100; // Exact match
          } else if (productName.includes(normalizedName)) {
            score += 80; // Contains full name
          } else {
            // Count matching words
            const matchingWords = nameParts.filter((p) => productName.includes(p));
            score += matchingWords.length * 20;
          }

          // Score based on vintage match
          if (hasVintage && match.product.year) {
            if (match.product.year === vintageYear) {
              score += 50; // Exact vintage match
            } else if (Math.abs(match.product.year - vintageYear) <= 1) {
              score += 20; // Close vintage
            }
          }

          // Score based on producer match
          if (item.producer && match.product.producer) {
            const prodNormalized = item.producer.toLowerCase();
            const matchProducer = match.product.producer.toLowerCase();
            if (matchProducer.includes(prodNormalized) || prodNormalized.includes(matchProducer)) {
              score += 30;
            }
          }

          // Prefer items with more stock
          if (match.offer.availableQuantity >= item.quantity) {
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
        result.product = bestMatch.product;
        result.offer = {
          id: bestMatch.offer.id,
          price: bestMatch.offer.price,
          currency: bestMatch.offer.currency,
          unitSize: bestMatch.offer.unitSize,
          unitCount: bestMatch.offer.unitCount,
          availableQuantity: bestMatch.offer.availableQuantity,
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
