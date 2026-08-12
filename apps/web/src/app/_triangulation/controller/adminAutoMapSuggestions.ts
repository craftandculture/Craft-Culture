import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import mapImportLines from '../data/mapImportLines';
import { autoMapSchema } from '../schemas/triangulationSchemas';
import type { TriAliasSource } from '../schemas/triangulationSchemas';

/**
 * Similarity a name match must reach before it is accepted without a human.
 * Trigram similarity on wine names is generous — two different cuvées from one
 * producer score highly — so this sits well above the 0.25 used to *offer* a
 * suggestion.
 */
const MIN_SCORE = 0.55;

/**
 * How far ahead of the runner-up the winner must be.
 * A producer with several cuvées produces a cluster of near-identical scores;
 * picking the top of a tie is how the wrong wine gets mapped.
 */
const MIN_LEAD = 0.08;

interface Candidate {
  normalizedCode: string;
  rawCode: string | null;
  rawDescription: string | null;
  aliasSource: TriAliasSource;
  lineVintage: number | null;
  bestSkuId: string | null;
  bestWCode: string | null;
  bestName: string | null;
  bestVintage: number | null;
  bestScore: number | null;
  runnerUpScore: number | null;
}

/**
 * Map every unmapped code whose best name match is unambiguous
 *
 * Resolving several hundred codes by hand is the difference between this tool
 * being used monthly and not, but a wrong mapping is worse than no mapping — it
 * moves someone else's bottles onto this wine and the figure still looks
 * plausible. So a match is only taken when it clears a high similarity bar,
 * beats its runner-up by a clear margin, and does not contradict a vintage.
 *
 * Everything it declines stays in the queue for a human, and everything it does
 * is an ordinary alias that can be deleted.
 */
const adminAutoMapSuggestions = adminProcedure
  .input(autoMapSchema)
  .mutation(async ({ input, ctx }) => {
    const { dryRun } = input;

    const candidates = await client<Candidate[]>`
      WITH unmapped AS (
        SELECT
          l.normalized_code AS "normalizedCode",
          MIN(l.raw_code) AS "rawCode",
          MIN(l.raw_description) AS "rawDescription",
          MIN(i.alias_source) AS "aliasSource",
          -- The vintage is often only in the name, so read it from there when
          -- the source did not give it its own column.
          MAX(COALESCE(
            NULLIF(REGEXP_REPLACE(COALESCE(l.raw_vintage, ''), '\\D', '', 'g'), '')::int,
            NULLIF(SUBSTRING(l.raw_description FROM '\\m(19|20)\\d{2}\\M'), '')::int
          )) AS "lineVintage"
        FROM tri_import_lines l
        JOIN tri_imports i ON i.id = l.import_id
        WHERE l.status = 'unmapped'
          AND COALESCE(l.normalized_code, '') <> ''
          AND COALESCE(l.raw_description, '') <> ''
        GROUP BY l.normalized_code
      )
      SELECT
        u.*,
        m."bestSkuId",
        m."bestWCode",
        m."bestName",
        m."bestVintage",
        m."bestScore",
        m."runnerUpScore"
      FROM unmapped u
      LEFT JOIN LATERAL (
        SELECT
          (ARRAY_AGG(x.id ORDER BY x.score DESC))[1] AS "bestSkuId",
          (ARRAY_AGG(x.w_code ORDER BY x.score DESC))[1] AS "bestWCode",
          (ARRAY_AGG(x.product_name ORDER BY x.score DESC))[1] AS "bestName",
          (ARRAY_AGG(x.vintage ORDER BY x.score DESC))[1] AS "bestVintage",
          (ARRAY_AGG(x.score ORDER BY x.score DESC))[1]::float8 AS "bestScore",
          (ARRAY_AGG(x.score ORDER BY x.score DESC))[2]::float8 AS "runnerUpScore"
        FROM (
          SELECT
            s.id, s.w_code, s.product_name, s.vintage,
            similarity(s.product_name, u."rawDescription") AS score
          FROM tri_skus s
          WHERE similarity(s.product_name, u."rawDescription") > 0.25
          ORDER BY score DESC
          LIMIT 5
        ) x
      ) m ON TRUE
    `;

    const accepted: {
      code: string;
      description: string | null;
      wCode: string;
      score: number;
    }[] = [];
    const declined: { code: string; reason: string }[] = [];

    for (const candidate of candidates) {
      const { bestSkuId, bestScore, runnerUpScore, bestWCode } = candidate;

      if (!bestSkuId || bestScore === null || !bestWCode) {
        declined.push({ code: candidate.normalizedCode, reason: 'no match' });
        continue;
      }

      if (bestScore < MIN_SCORE) {
        declined.push({ code: candidate.normalizedCode, reason: 'match too weak' });
        continue;
      }

      if (runnerUpScore !== null && bestScore - runnerUpScore < MIN_LEAD) {
        declined.push({
          code: candidate.normalizedCode,
          reason: 'two candidates too close to call',
        });
        continue;
      }

      // A stated vintage that disagrees is decisive: same wine, wrong year is
      // a different SKU entirely, and the names are near-identical.
      if (
        candidate.lineVintage &&
        candidate.bestVintage &&
        candidate.lineVintage !== candidate.bestVintage
      ) {
        declined.push({ code: candidate.normalizedCode, reason: 'vintage disagrees' });
        continue;
      }

      accepted.push({
        code: candidate.normalizedCode,
        description: candidate.rawDescription,
        wCode: bestWCode,
        score: bestScore,
      });

      if (dryRun) {
        continue;
      }

      await client`
        INSERT INTO tri_sku_aliases (
          sku_id, source, alias_code, normalized_code, alias_name, created_by
        )
        VALUES (
          ${bestSkuId}, ${candidate.aliasSource},
          ${candidate.rawCode?.trim() || candidate.normalizedCode},
          ${candidate.normalizedCode}, ${candidate.rawDescription}, ${ctx.user.id}
        )
        ON CONFLICT (source, normalized_code) DO UPDATE SET
          sku_id = ${bestSkuId}, updated_at = NOW()
      `;
    }

    if (!dryRun && accepted.length > 0) {
      const imports = await client<{ id: string; aliasSource: TriAliasSource }[]>`
        SELECT DISTINCT i.id, i.alias_source AS "aliasSource"
        FROM tri_imports i
        JOIN tri_import_lines l ON l.import_id = i.id
        WHERE l.status = 'unmapped'
      `;

      for (const record of imports) {
        await mapImportLines(record.id, record.aliasSource);
      }
    }

    return {
      dryRun,
      accepted: accepted.length,
      declined: declined.length,
      // Named so a bad automatic mapping can be found and undone, rather than
      // being discovered later as an unexplained variance.
      examples: accepted.slice(0, 8),
    };
  });

export default adminAutoMapSuggestions;
