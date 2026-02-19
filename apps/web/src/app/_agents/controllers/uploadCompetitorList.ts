import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { competitorWines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import uploadCompetitorListSchema from '../schemas/uploadCompetitorListSchema';

const INSERT_BATCH = 500;

/**
 * Upload a competitor wine price list
 *
 * Inserts rows immediately, then runs a single bulk LWIN match query.
 * Much faster than per-row matching for large lists (4000+ wines).
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

    // Build insert values without LWIN matching (fast)
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

    // Bulk LWIN match — single SQL query instead of thousands of individual ones
    const [matchResult] = await db.execute<{ matched: number }>(sql`
      WITH matches AS (
        UPDATE competitor_wines cw
        SET lwin18_match = sub.lwin
        FROM (
          SELECT DISTINCT ON (cw2.id) cw2.id, lw.lwin
          FROM competitor_wines cw2
          CROSS JOIN LATERAL (
            SELECT lw.lwin
            FROM lwin_wines lw
            WHERE similarity(
              lw.display_name,
              regexp_replace(cw2.product_name, '\y(19|20)\d{2}\y', '', 'g')
            ) > 0.25
            ORDER BY similarity(
              lw.display_name,
              regexp_replace(cw2.product_name, '\y(19|20)\d{2}\y', '', 'g')
            ) DESC
            LIMIT 1
          ) lw
          WHERE cw2.competitor_name = ${competitorName}
            AND cw2.is_active = true
            AND cw2.lwin18_match IS NULL
        ) sub
        WHERE cw.id = sub.id
        RETURNING cw.id
      )
      SELECT COUNT(*)::int AS matched FROM matches
    `);

    const matchedCount = matchResult?.matched ?? 0;

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
