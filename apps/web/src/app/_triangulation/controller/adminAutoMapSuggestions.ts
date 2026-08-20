import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import mapImportLines from '../data/mapImportLines';
import { autoMapSchema } from '../schemas/triangulationSchemas';
import type { TriAliasSource } from '../schemas/triangulationSchemas';
import wineIdentity from '../utils/wineIdentity';

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
 * Map every unmapped code that can be resolved without a judgment call
 *
 * The codes are archaeology. This stock shipped before there were systems, so
 * whatever went on the invoice went into Zoho; then LWIN arrived; then LWIN
 * with dashes became the standard. Three conventions, none applied backwards,
 * and no single code column that spans them. What did survive every era is the
 * name and the invoice.
 *
 * So the name leads, and it is matched on identity rather than resemblance:
 * the vintage must agree, the bottle size must agree, and what is left of the
 * name once both are removed must be the same wine. That is a far stronger
 * statement than a similarity score, which cannot tell two cuvées from one
 * grower apart, and it is why an exact identity match is taken outright while a
 * merely similar name still has to clear the old bars.
 *
 * Three passes, in descending order of certainty:
 *
 *   1. The code carries a known W code or LWIN inside it — `W35100324` inside
 *      `W35100324-2022-06-00750`. Arithmetic, not judgment.
 *   2. Exactly one SKU has the same wine identity as the line's description.
 *   3. Nothing else fits, so fall back to similarity with its old guards.
 *
 * A wrong mapping is worse than no mapping: it moves someone else's bottles
 * onto this wine and the figure still looks plausible. Everything declined
 * stays in the queue, and everything taken is an ordinary alias that can be
 * deleted.
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

    // Every SKU's identity, and every code that already resolves to one. Held
    // in memory because each candidate is checked against all of them and the
    // registry is small — a few hundred rows against a few hundred codes.
    const skus = await client<
      {
        id: string;
        wCode: string;
        productName: string;
        vintage: number | null;
        bottleSize: string | null;
        lwin18: string | null;
      }[]
    >`
      SELECT id, w_code AS "wCode", product_name AS "productName",
             vintage, bottle_size AS "bottleSize", lwin18
      FROM tri_skus
    `;

    const normalize = (value: string) =>
      value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const identities = skus.map((sku) => ({
      sku,
      identity: wineIdentity(sku.productName, sku.vintage, sku.bottleSize),
      keys: [normalize(sku.wCode), normalize(sku.lwin18 ?? '')].filter(
        (key) => key.length >= 6,
      ),
    }));

    /** A code that contains a known W code or LWIN belongs to that SKU. */
    const byEmbeddedCode = (code: string) => {
      const hits = identities.filter((entry) =>
        entry.keys.some((key) => code.startsWith(key)),
      );

      // Longest key wins: a W code that is a prefix of another must not claim
      // the longer one's codes.
      return hits.length === 0
        ? null
        : hits.sort(
            (a, b) =>
              Math.max(...b.keys.map((key) => key.length)) -
              Math.max(...a.keys.map((key) => key.length)),
          )[0];
    };

    /** Same wine, same vintage, same bottle size — and only one such SKU. */
    const byIdentity = (description: string | null) => {
      if (!description) return null;

      const line = wineIdentity(description, null, null);

      if (!line.base) return null;

      const hits = identities.filter((entry) => {
        if (entry.identity.base !== line.base) return false;

        if (
          line.vintage !== null &&
          entry.identity.vintage !== null &&
          line.vintage !== entry.identity.vintage
        ) {
          return false;
        }

        if (
          line.sizeMl !== null &&
          entry.identity.sizeMl !== null &&
          line.sizeMl !== entry.identity.sizeMl
        ) {
          return false;
        }

        return true;
      });

      // Two SKUs matching equally well is the split-SKU case. Picking either
      // is a coin toss that looks like a decision, so it goes to a human.
      return hits.length === 1 ? hits[0] : null;
    };

    const accepted: {
      code: string;
      description: string | null;
      wCode: string;
      score: number;
      method: 'code' | 'identity' | 'similarity';
    }[] = [];
    const declined: { code: string; description: string | null; reason: string }[] =
      [];

    for (const candidate of candidates) {
      const { bestSkuId, bestScore, runnerUpScore, bestWCode } = candidate;

      const embedded = byEmbeddedCode(candidate.normalizedCode);
      const identical = embedded ? null : byIdentity(candidate.rawDescription);
      const certain = embedded ?? identical;

      if (certain) {
        accepted.push({
          code: candidate.normalizedCode,
          description: candidate.rawDescription,
          wCode: certain.sku.wCode,
          score: 1,
          method: embedded ? 'code' : 'identity',
        });

        if (!dryRun) {
          await client`
            INSERT INTO tri_sku_aliases (
              sku_id, source, alias_code, normalized_code, alias_name, created_by
            )
            VALUES (
              ${certain.sku.id}, ${candidate.aliasSource},
              ${candidate.rawCode?.trim() || candidate.normalizedCode},
              ${candidate.normalizedCode}, ${candidate.rawDescription},
              ${ctx.user.id}
            )
            ON CONFLICT (programme_id, source, normalized_code) DO UPDATE SET
              sku_id = ${certain.sku.id}, updated_at = NOW()
          `;
        }

        continue;
      }

      if (!bestSkuId || bestScore === null || !bestWCode) {
        declined.push({
          code: candidate.normalizedCode,
          description: candidate.rawDescription,
          reason: 'no match',
        });
        continue;
      }

      if (bestScore < MIN_SCORE) {
        declined.push({
          code: candidate.normalizedCode,
          description: candidate.rawDescription,
          reason: 'match too weak',
        });
        continue;
      }

      if (runnerUpScore !== null && bestScore - runnerUpScore < MIN_LEAD) {
        declined.push({
          code: candidate.normalizedCode,
          description: candidate.rawDescription,
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
        declined.push({
          code: candidate.normalizedCode,
          description: candidate.rawDescription,
          reason: 'vintage disagrees',
        });
        continue;
      }

      accepted.push({
        code: candidate.normalizedCode,
        description: candidate.rawDescription,
        wCode: bestWCode,
        score: bestScore,
        method: 'similarity',
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
        ON CONFLICT (programme_id, source, normalized_code) DO UPDATE SET
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
      // Split by how each was reached: a run that resolves 150 codes off the
      // W code buried in them is a different event from one that leant on 150
      // similarity guesses, and only one of those is worth trusting unread.
      byCode: accepted.filter((entry) => entry.method === 'code').length,
      byIdentity: accepted.filter((entry) => entry.method === 'identity').length,
      bySimilarity: accepted.filter((entry) => entry.method === 'similarity')
        .length,
      // Named so a bad automatic mapping can be found and undone, rather than
      // being discovered later as an unexplained variance.
      examples: accepted.slice(0, 8),
      // Why it stood back matters as much as what it took: "two candidates too
      // close to call" is the signature of one wine registered twice, which is
      // a different job from a code that simply has no match.
      declinedExamples: declined.slice(0, 8),
    };
  });

export default adminAutoMapSuggestions;
