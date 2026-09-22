import { TRPCError } from '@trpc/server';
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

/** Alike enough that the two names are describing one wine */
const ACCEPT_AT = 0.55;

/** How far clear of the runner-up the winner has to be to stand unaided */
const MARGIN = 0.15;

interface OursRow {
  lwin18: string;
  productName: string;
  ownerName: string;
  outBottles: number;
}

interface TheirsRow {
  outletCode: string;
  productName: string;
}

/** Vintage anywhere in a name — required on both sides before linking alone */
const VINTAGE = /\b(19|20)\d{2}\b/;

/**
 * Link the lines whose names leave nothing to decide
 *
 * The distributor writes "Guidalberto, Tenuta San Guido, Toscana 2020" and we
 * write "Tenuta San Guido Guidalberto Toscana 2020". Those are one wine, and
 * making a person confirm 88 of them one at a time is how a mapping job never
 * gets done.
 *
 * What is refused is as important. A name only links itself when it wins
 * clearly — well matched, and well ahead of whatever came second — and when
 * both sides state a vintage, because a wine named without one cannot be told
 * from its neighbour year. Bordeaux is why: "Chateau Margaux 2017" and
 * "Rauzan-Segla Margaux 2017" share the word that matters, so on those the
 * runner-up sits close and nothing is written. Those stay on the screen for a
 * person, which is the job this leaves behind rather than the job it does.
 *
 * A tie between two of our own wines is not a doubt where they share an owner:
 * the same wine reaches us under several LWINs, and only the owners
 * disagreeing makes the choice matter. That check is on the owner rather than
 * the score, because the owner is what a wrong answer costs.
 *
 * The margin rule is not a proof. Where the distributor names a wine briefly
 * and the brief name is exactly a chateau — "Margaux 2017" — it matches that
 * chateau perfectly and beats the runner-up by a wide margin while still being
 * a guess, because the appellation and the estate are the same word. Requiring
 * a vintage on both sides removes most of that, and what remains is why every
 * sweep is reversible.
 *
 * Written as `auto-name` rather than `confirmed`, so a sweep can be undone
 * whole without touching a link anybody made by hand.
 *
 * @param outletId - The distributor to map
 * @param mode - Preview the sweep, apply it, or undo the last one
 * @returns What was linked, what was left, and why it was left
 */
const adminAutoLinkCodes = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      mode: z.enum(['preview', 'apply', 'undo']).default('preview'),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await confirmedLinksReady())) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Code links are not available yet — the cons_code_links migration ' +
          'has not run on this database.',
      });
    }

    if (input.mode === 'undo') {
      const removed = await client<{ outletCode: string }[]>`
        DELETE FROM cons_code_links
        WHERE outlet_id = ${input.outletId} AND source = 'auto-name'
        RETURNING outlet_code AS "outletCode"
      `;

      return { mode: 'undo' as const, linked: removed.length, proposals: [] };
    }

    const hasLinks = true;

    const reached = await client<{ outletCode: string }[]>`
      WITH latest AS (
        SELECT MAX(taken_at) AS taken_at
        FROM cons_snapshots WHERE outlet_id = ${input.outletId}
      ),
      ${codeBridgeCtes(input.outletId, hasLinks)}
      SELECT DISTINCT s.outlet_code AS "outletCode"
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
    const mappedCodes = new Set(reached.map((row) => norm(row.outletCode)));

    const ours = await client<OursRow[]>`
      SELECT m.lwin18, MIN(m.product_name) AS "productName",
             MIN(ow.name) AS "ownerName",
             SUM(m.bottles)::float8 AS "outBottles"
      FROM cons_movements m
      JOIN cons_arrangements a ON a.id = m.arrangement_id
      JOIN cons_owners ow ON ow.id = a.owner_id
      WHERE a.outlet_id = ${input.outletId}
        AND m.kind = 'out'
        AND m.lwin18 IS NOT NULL
      GROUP BY m.lwin18
    `;

    const theirs = await client<TheirsRow[]>`
      WITH latest AS (
        SELECT MAX(taken_at) AS taken_at
        FROM cons_snapshots WHERE outlet_id = ${input.outletId}
      )
      SELECT s.outlet_code AS "outletCode", s.product_name AS "productName"
      FROM cons_snapshots s, latest
      WHERE s.outlet_id = ${input.outletId}
        AND s.taken_at = latest.taken_at
        AND s.regime = 'consigned'
    `;

    const proposals: {
      outletCode: string;
      theirProductName: string;
      lwin18: string;
      ourProductName: string;
      score: number;
      runnerUp: number;
    }[] = [];

    let heldBack = 0;

    for (const line of theirs) {
      if (mappedCodes.has(norm(line.outletCode))) continue;

      const ranked = ours
        .map((wine) => ({
          wine,
          ...scoreWineMatch(wine.productName, line.productName),
        }))
        .filter((entry) => !entry.rejected)
        .sort((a, b) => b.score - a.score);

      const best = ranked[0];

      if (!best || best.score < ACCEPT_AT) {
        heldBack += 1;
        continue;
      }

      /*
        Everything close enough to the winner to be the winner.

        A tie is not automatically a doubt. Our own side carries the same wine
        under more than one LWIN — an invoice in 6x75cl and another in
        bottles — so "Elio Grasso, Barolo, Ginestra Casa Mate 2020" ties with
        itself and the margin rule refused the easiest row on the page. What
        makes a tie dangerous is the owners disagreeing, because then the
        choice decides who gets paid. Where they agree, the wine is the same
        wine and the largest position takes it.
      */
      const tied = ranked.filter((entry) => best.score - entry.score < MARGIN);
      const owners = new Set(tied.map((entry) => entry.wine.ownerName));

      if (owners.size > 1) {
        heldBack += 1;
        continue;
      }

      const winner = tied.reduce((most, entry) =>
        entry.wine.outBottles > most.wine.outBottles ? entry : most,
      );

      /*
        A wine named without a year cannot be told from the year either side
        of it, and the distributor names several that way.
      */
      if (
        !VINTAGE.test(line.productName) ||
        !VINTAGE.test(winner.wine.productName)
      ) {
        heldBack += 1;
        continue;
      }

      proposals.push({
        outletCode: line.outletCode,
        theirProductName: line.productName,
        lwin18: winner.wine.lwin18,
        ourProductName: winner.wine.productName,
        score: best.score,
        runnerUp: tied.length > 1 ? best.score : 0,
      });
    }

    if (input.mode === 'preview') {
      return { mode: 'preview' as const, linked: 0, heldBack, proposals };
    }

    for (const row of proposals) {
      await client`
        INSERT INTO cons_code_links (
          outlet_id, outlet_code, lwin18, outlet_product_name,
          our_product_name, source, confirmed_by
        )
        VALUES (
          ${input.outletId}, ${row.outletCode}, ${row.lwin18},
          ${row.theirProductName}, ${row.ourProductName},
          'auto-name', ${ctx.user.id}
        )
        ON CONFLICT (outlet_id, outlet_code) DO NOTHING
      `;
    }

    return {
      mode: 'apply' as const,
      linked: proposals.length,
      heldBack,
      proposals,
    };
  });

export default adminAutoLinkCodes;
