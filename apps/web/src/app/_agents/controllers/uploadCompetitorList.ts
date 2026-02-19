import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { competitorWines, lwinWines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import uploadCompetitorListSchema from '../schemas/uploadCompetitorListSchema';

/**
 * Try to match a product name to the LWIN database using pg_trgm similarity
 */
const matchLwin = async (productName: string) => {
  const cleaned = productName.replace(/\b(19|20)\d{2}\b/g, '').trim();

  try {
    const results = await db
      .select({
        lwin: lwinWines.lwin,
        displayName: lwinWines.displayName,
        similarity: sql<number>`similarity(${lwinWines.displayName}, ${cleaned})`,
      })
      .from(lwinWines)
      .where(sql`similarity(${lwinWines.displayName}, ${cleaned}) > 0.25`)
      .orderBy(sql`similarity(${lwinWines.displayName}, ${cleaned}) DESC`)
      .limit(1);

    if (results.length === 0 || !results[0]) return null;
    return results[0];
  } catch {
    return null;
  }
};

/**
 * Upload a competitor wine price list
 *
 * Deactivates previous entries for the same competitor, then inserts
 * new rows with optional LWIN matching.
 */
const uploadCompetitorList = adminProcedure
  .input(uploadCompetitorListSchema)
  .mutation(async ({ input, ctx }) => {
    const { competitorName, source, rows, appendMode } = input;

    logger.info('[Agents] Uploading competitor list', {
      competitor: competitorName,
      rowCount: rows.length,
      appendMode: !!appendMode,
    });

    // Deactivate previous entries (skip in append mode for chunked uploads)
    if (!appendMode) {
      await db
        .update(competitorWines)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(competitorWines.competitorName, competitorName));
    }

    // Process rows with parallel LWIN matching in batches
    const MATCH_BATCH = 50;
    const INSERT_BATCH = 500;
    let matchedCount = 0;
    const insertValues = [];

    for (let i = 0; i < rows.length; i += MATCH_BATCH) {
      const batch = rows.slice(i, i + MATCH_BATCH);
      const matches = await Promise.all(
        batch.map((row) => matchLwin(row.productName)),
      );

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j]!;
        const lwinMatch = matches[j];
        const lwin18Match =
          lwinMatch && lwinMatch.similarity >= 0.3 ? lwinMatch.lwin : null;

        if (lwin18Match) matchedCount++;

        insertValues.push({
          competitorName,
          productName: row.productName,
          vintage: row.vintage ?? null,
          country: row.country ?? null,
          region: row.region ?? null,
          bottleSize: row.bottleSize ?? null,
          sellingPriceAed: row.sellingPriceAed ?? null,
          sellingPriceUsd: row.sellingPriceUsd ?? null,
          quantity: row.quantity ?? null,
          source: source ?? null,
          uploadedBy: ctx.user.id,
          isActive: true,
          lwin18Match,
        });
      }
    }

    // Batch insert in chunks to stay under Postgres parameter limits
    for (let i = 0; i < insertValues.length; i += INSERT_BATCH) {
      await db
        .insert(competitorWines)
        .values(insertValues.slice(i, i + INSERT_BATCH));
    }

    logger.info('[Agents] Competitor list uploaded', {
      competitor: competitorName,
      total: rows.length,
      matched: matchedCount,
    });

    return {
      success: true,
      total: rows.length,
      matched: matchedCount,
      unmatched: rows.length - matchedCount,
    };
  });

export default uploadCompetitorList;
