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

/** As many as a person will work through in a sitting */
const LIST_LIMIT = 20;

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

export interface OurWine {
  lwin18: string;
  productName: string;
  ownerName: string;
  outBottles: number;
}

export interface UnclaimedLine {
  /** Their code — CDR0131177237 — which is what a link is keyed on */
  outletCode: string;
  theirProductName: string;
  bottlesOnHand: number;
  soldLast30d: number | null;
  candidates: (OurWine & {
    score: number;
    /** Whether their position could have come from what we sent */
    arithmeticHolds: boolean;
  })[];
}

/**
 * The distributor's lines that reach no wine of ours, and what each might be
 *
 * Asked from their side, because that is the side the question has. City
 * Drinks' feed carries their own code and, beside it, the code they hold for
 * us — a W code where Crurated issued one, otherwise a label they invented.
 * Every line with that field filled maps itself and never appears here. What
 * is left is the handful where the field is simply **blank**: four lines, and
 * four bottles of ours consequently showing no position.
 *
 * So the durable fix is not here. It is City Drinks filling four fields in
 * their product master, after which the bridge maps them on the next pull and
 * keeps doing so. This screen is what closes the gap until they do, and what
 * closes it if they will not.
 *
 * Asked the other way round — our unlinked wines, each hunting a line — it
 * produced a hundred rows to settle four questions, which is the same work
 * multiplied by everything we ever sent them. Their unclaimed lines are the
 * short list, and each needs exactly one wine chosen.
 *
 * Names rank the choice and never make it: the full list of our unmatched
 * wines is returned alongside, because the right wine is sometimes one no name
 * would suggest, and an earlier attempt to let names decide matched ten wines
 * of thirteen and got every one wrong.
 *
 * Deliberately not filtered by owner, though the rest of the page is. An
 * unclaimed line has no owner — that is the whole of what is wrong with it,
 * and choosing the wine is what decides one. Narrowed to the owner in the
 * chip, this offered Cult's wines as answers for a line that was never Cult's,
 * which is a wrong link in the one direction that moves money between owners.
 *
 * @param outletId - The distributor to link against
 * @returns Their unclaimed lines with ranked candidates, and every wine of
 *   ours still unreached so a person can pick past the ranking
 */
const adminGetCodeSuggestions = adminProcedure
  .input(z.object({ outletId: z.string().uuid() }))
  .query(async ({ input }) => {
    const hasLinks = await confirmedLinksReady();

    /*
      Everything the bridge already reaches, read from the same definition the
      balances use so the two can never disagree about what is mapped.
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

    const lines: UnclaimedLine[] = unmappedTheirs.map((line) => ({
      outletCode: line.outletCode,
      theirProductName: line.productName,
      bottlesOnHand: line.bottlesOnHand,
      soldLast30d: line.soldLast30d,
      candidates: unmappedOurs
        .map((wine) => ({
          wine,
          ...scoreWineMatch(wine.productName, line.productName),
        }))
        .filter((entry) => !entry.rejected && entry.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map(({ wine, score }) => ({
          lwin18: wine.lwin18,
          productName: wine.productName,
          ownerName: wine.ownerName,
          outBottles: wine.outBottles,
          score,
          /*
            Could their position have come from what we sent? Stock plus a
            month's sales above everything we ever invoiced out is not a near
            miss — it is the wrong wine.
          */
          arithmeticHolds:
            line.bottlesOnHand + (line.soldLast30d ?? 0) <= wine.outBottles,
        })),
    }));

    /*
      Bottles first, and only lines they actually hold.

      Turning off the bridge's raw-string fallback revealed that 88 of 163
      consigned lines reach no wine of ours — the fallback had been handing
      back their own label as a key, so they read as mapped while matching
      nothing. That is the reason Sold is blank across the page, and it is a
      mapping job rather than a list of questions: dumped whole it is 88 rows
      to click through. A line they hold no bottles of moves no money, so the
      ones with stock come first and the tail is counted rather than listed.
    */
    const worthClaiming = lines
      .filter((line) => line.bottlesOnHand > 0 || (line.soldLast30d ?? 0) > 0)
      .sort((a, b) => b.bottlesOnHand - a.bottlesOnHand);

    return {
      lines: worthClaiming.slice(0, LIST_LIMIT),
      /** Lines reaching nothing that they hold no stock of, so nothing is owed */
      dormant: lines.length - worthClaiming.length,
      /** Held back from the list, not from the problem */
      beyondList: Math.max(worthClaiming.length - LIST_LIMIT, 0),
      unreachedTotal: lines.length,
      /* To pick past the ranking, since names are a suggestion and not more */
      ourUnmatched: unmappedOurs.map((wine) => ({
        lwin18: wine.lwin18,
        productName: wine.productName,
        ownerName: wine.ownerName,
        outBottles: wine.outBottles,
      })),
      /* What the bridge got without anyone being asked */
      mappedByCode: mappedWines.size,
    };
  });

export default adminGetCodeSuggestions;
