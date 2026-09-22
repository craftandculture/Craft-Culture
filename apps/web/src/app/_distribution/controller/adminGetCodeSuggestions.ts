import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import {
  codeBridgeCtes,
  codeBridgeJoins,
  confirmedLinksReady,
  resolvedSnapshotCode,
} from '../utils/codeBridge';
import scoreWineMatch from '../utils/scoreWineMatch';

interface OursRow {
  lwin18: string;
  productName: string;
  ownerName: string;
  ownerId: string;
  outBottles: number;
}

interface TheirsRow {
  outletCode: string;
  ourCode: string | null;
  productName: string;
  bottlesOnHand: number;
  soldLast30d: number | null;
}

export interface CodeSuggestion {
  lwin18: string;
  ourProductName: string;
  ownerName: string;
  outBottles: number;
  candidates: {
    outletCode: string;
    theirProductName: string;
    bottlesOnHand: number;
    soldLast30d: number | null;
    score: number;
    /** Whether stock plus sales could have come from what we sent */
    arithmeticHolds: boolean;
  }[];
}

/**
 * Propose which of the distributor's lines is which of our wines
 *
 * This is the last resort, and it should be a short list. `codeBridge` reaches
 * most wines by code already — a confirmed link, their CDR code through the
 * mapping done by hand, or the W code through the warehouse — and everything
 * it reaches is excluded here. What is left is the wine City Drinks coded in a
 * way nothing of ours has ever recorded.
 *
 * For those the only shared field is the name, and names cannot decide this.
 * "Margaux" is a château and also the appellation half of Bordeaux sits in; an
 * earlier attempt to let names decide matched ten wines of thirteen and got
 * every one wrong.
 *
 * So this proposes and does not conclude. Each of our unlinked wines gets a
 * short ranked list, and each candidate carries the check that actually
 * matters: whether their stock plus their sales could have come from what we
 * invoiced out. A link that fails that is almost certainly the wrong wine, and
 * it is shown rather than hidden so the judgement is made with it in view.
 *
 * @param outletId - The distributor to link against
 * @returns Our unlinked wines, each with ranked candidates
 */
const adminGetCodeSuggestions = adminProcedure
  .input(z.object({ outletId: z.string().uuid() }))
  .query(async ({ input }) => {
    const hasLinks = await confirmedLinksReady();

    /*
      Everything the bridge already reaches, so neither side of the suggestion
      list repeats work that is done. Read from the same definition the
      balances use, so the two can never disagree about what is mapped.
    */
    const reached = await client<{ lwin: string; outletCode: string }[]>`
      WITH latest AS (
        SELECT MAX(taken_at) AS taken_at
        FROM cons_snapshots WHERE outlet_id = ${input.outletId}
      ),
      ${codeBridgeCtes(input.outletId, hasLinks)}
      SELECT DISTINCT ${resolvedSnapshotCode()} AS lwin,
             s.outlet_code AS "outletCode"
      FROM cons_snapshots s
      CROSS JOIN latest
      ${codeBridgeJoins()}
      WHERE s.outlet_id = ${input.outletId}
        AND s.taken_at = latest.taken_at
        AND s.regime = 'consigned'
        AND ${resolvedSnapshotCode()} IS NOT NULL
    `;

    const norm = (value: string) =>
      value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const mappedWines = new Set(reached.map((row) => row.lwin));
    const mappedCodes = new Set(reached.map((row) => norm(row.outletCode)));

    const ours = await client<OursRow[]>`
      SELECT m.lwin18,
             MIN(m.product_name) AS "productName",
             MIN(ow.name) AS "ownerName",
             a.owner_id AS "ownerId",
             SUM(m.bottles)::float8 AS "outBottles"
      FROM cons_movements m
      JOIN cons_arrangements a ON a.id = m.arrangement_id
      JOIN cons_owners ow ON ow.id = a.owner_id
      WHERE a.outlet_id = ${input.outletId}
        AND m.kind = 'out'
        AND m.lwin18 IS NOT NULL
      GROUP BY m.lwin18, a.owner_id
      ORDER BY SUM(m.bottles) DESC
    `;

    const theirs = await client<TheirsRow[]>`
      WITH latest AS (
        SELECT MAX(taken_at) AS taken_at
        FROM cons_snapshots WHERE outlet_id = ${input.outletId}
      )
      SELECT s.outlet_code AS "outletCode", s.our_code AS "ourCode",
             s.product_name AS "productName",
             s.bottles_on_hand AS "bottlesOnHand",
             s.sold_last_30d AS "soldLast30d"
      FROM cons_snapshots s, latest
      WHERE s.outlet_id = ${input.outletId}
        AND s.taken_at = latest.taken_at
        AND s.regime = 'consigned'
    `;

    const unmappedOurs = ours.filter(
      (wine) => !mappedWines.has(norm(wine.lwin18)),
    );
    const unmappedTheirs = theirs.filter(
      (line) => !mappedCodes.has(norm(line.outletCode)),
    );

    const suggestions: CodeSuggestion[] = unmappedOurs.map((wine) => {
      const candidates = unmappedTheirs
        .map((line) => {
          const { score, rejected } = scoreWineMatch(
            wine.productName,
            line.productName,
          );

          return { line, score, rejected };
        })
        .filter((entry) => !entry.rejected && entry.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map(({ line, score }) => ({
          outletCode: line.outletCode,
          theirProductName: line.productName,
          bottlesOnHand: line.bottlesOnHand,
          soldLast30d: line.soldLast30d,
          score,
          /*
            Could their position have come from what we sent? Stock plus a
            month's sales above everything we ever invoiced out is not a near
            miss — it is the wrong wine.
          */
          arithmeticHolds:
            line.bottlesOnHand + (line.soldLast30d ?? 0) <= wine.outBottles,
        }));

      return {
        lwin18: wine.lwin18,
        ourProductName: wine.productName,
        ownerName: wine.ownerName,
        outBottles: wine.outBottles,
        candidates,
      };
    });

    return {
      /* Wines with something to consider first; the rest still listed */
      suggestions: suggestions.sort(
        (a, b) => b.candidates.length - a.candidates.length,
      ),
      unlinkedOurs: unmappedOurs.length,
      unlinkedTheirs: unmappedTheirs.length,
      /* What the bridge got without anyone being asked */
      mappedByCode: mappedWines.size,
    };
  });

export default adminGetCodeSuggestions;
