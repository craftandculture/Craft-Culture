import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { competitorWines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import uploadCompetitorListSchema from '../schemas/uploadCompetitorListSchema';

const INSERT_BATCH = 500;

/**
 * Upload a competitor wine price list
 *
 * Inserts rows immediately without LWIN matching for speed.
 * LWIN matching happens separately when the Scout agent runs.
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

    // Build insert values — no LWIN matching during upload for speed
    const insertValues = rows.map((row) => ({
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
    }));

    // Batch insert in chunks to stay under Postgres parameter limits
    for (let i = 0; i < insertValues.length; i += INSERT_BATCH) {
      await db
        .insert(competitorWines)
        .values(insertValues.slice(i, i + INSERT_BATCH));
    }

    logger.info('[Agents] Competitor list uploaded', {
      competitor: competitorName,
      total: rows.length,
    });

    return {
      success: true,
      total: rows.length,
      matched: 0,
      unmatched: rows.length,
    };
  });

export default uploadCompetitorList;
