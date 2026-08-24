import { TRPCError } from '@trpc/server';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  lwinWines,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import parseWineName from '../utils/parseWineName';

export interface AutoMatchRow {
  itemId: string;
  productName: string;
  /** The LWIN18 written, when the match was confident enough to take */
  lwin: string | null;
  matchedName: string | null;
  score: number;
  /** Why it was taken or left, in a phrase */
  verdict: string;
}

/** Below this the runner-up is close enough that picking one is a guess. */
const MIN_MARGIN = 0.12;

/** Below this nothing in 208k records resembled the line. */
const MIN_SCORE = 0.45;

/**
 * Match every unmapped line against the LWIN database in one pass
 *
 * A 163-line invoice is 163 searches, and searching is not the slow part —
 * reading a result list and deciding is. The database is 208k records and the
 * supplier already wrote down the producer, the wine, the vintage and the
 * bottle size; for most lines there is exactly one record that fits and no
 * decision to make.
 *
 * So the decision is only asked for where it is real. A line is taken
 * automatically when one candidate scores well *and* beats the next by a
 * margin — a clear winner is arithmetic, two close names are a judgement, and
 * conflating the two is how the wrong wine gets filed confidently.
 *
 * Everything else is returned with its best guess for a person to accept or
 * reject, which is a list to work through rather than a form to fill in 163
 * times.
 */
const adminAutoMatchLwins = adminProcedure
  .input(
    z.object({
      shipmentId: z.string().uuid(),
      /** Score and report without writing anything */
      dryRun: z.boolean().default(false),
    }),
  )
  .mutation(async ({ input }) => {
    const { shipmentId, dryRun } = input;

    const [shipment] = await db
      .select({ id: logisticsShipments.id })
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, shipmentId))
      .limit(1);

    if (!shipment) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Shipment not found' });
    }

    const items = await db
      .select({
        id: logisticsShipmentItems.id,
        productName: logisticsShipmentItems.productName,
        vintage: logisticsShipmentItems.vintage,
        bottleSizeMl: logisticsShipmentItems.bottleSizeMl,
        bottlesPerCase: logisticsShipmentItems.bottlesPerCase,
        totalBottles: logisticsShipmentItems.totalBottles,
      })
      .from(logisticsShipmentItems)
      .where(
        and(
          eq(logisticsShipmentItems.shipmentId, shipmentId),
          or(
            isNull(logisticsShipmentItems.lwin),
            eq(logisticsShipmentItems.lwin, ''),
          ),
        ),
      );

    const rows: AutoMatchRow[] = [];
    let applied = 0;

    for (const item of items) {
      const parsed = parseWineName(item.productName);

      if (parsed.searchName.length < 3) {
        rows.push({
          itemId: item.id,
          productName: item.productName,
          lwin: null,
          matchedName: null,
          score: 0,
          verdict: 'Nothing searchable in the product name',
        });
        continue;
      }

      // Ranked in the database rather than in memory: 208k records per line,
      // 163 lines, and only the top few ever matter.
      const candidates = await db
        .select({
          lwin: lwinWines.lwin,
          displayName: lwinWines.displayName,
          score: sql<number>`GREATEST(
            similarity(${lwinWines.displayName}, ${parsed.searchName}),
            similarity(
              (COALESCE(${lwinWines.producerName}, '') || ' ' || COALESCE(${lwinWines.wine}, '')),
              ${parsed.searchName}
            )
          )`.as('score'),
        })
        .from(lwinWines)
        .where(
          and(
            eq(lwinWines.status, 'live'),
            /*
              Narrowed by the trigram index on display_name alone.

              The second half of this used to be `producer || ' ' || wine %
              $1`, which is two bugs in one line. Postgres binds `%` tighter
              than `||`, so it read as `producer || ' ' || (wine % $1)` — a
              text value handed to OR, which is the error it raised. And the
              expression has no index, so every line would have scanned all
              208k records to find out.

              Producer and wine are still scored, above; they just no longer
              decide which rows are looked at.
            */
            sql`${lwinWines.displayName} % ${parsed.searchName}`,
          ),
        )
        .orderBy(sql`score DESC`)
        .limit(5);

      const best = candidates[0];
      const runnerUp = candidates[1];
      const score = Number(best?.score ?? 0);
      const margin = score - Number(runnerUp?.score ?? 0);

      if (!best || score < MIN_SCORE) {
        rows.push({
          itemId: item.id,
          productName: item.productName,
          lwin: null,
          matchedName: best?.displayName ?? null,
          score,
          verdict: 'No wine resembles this closely enough',
        });
        continue;
      }

      if (margin < MIN_MARGIN) {
        rows.push({
          itemId: item.id,
          productName: item.productName,
          lwin: null,
          matchedName: best.displayName,
          score,
          verdict: `Too close to "${runnerUp?.displayName ?? 'another wine'}" to choose`,
        });
        continue;
      }

      // LWIN18 is wine-vintage-pack-size, and the invoice supplied the last
      // three: the vintage is in the name, the pack is what was billed, and
      // the size is stated per bottle.
      const vintage = parsed.vintage ?? item.vintage;
      const sizeMl = parsed.bottleSizeMl ?? item.bottleSizeMl ?? 750;
      const pack = item.bottlesPerCase ?? item.totalBottles ?? 1;

      const lwin18 = [
        best.lwin,
        String(vintage ?? 0).padStart(4, '0'),
        String(pack).padStart(2, '0'),
        String(sizeMl).padStart(5, '0'),
      ].join('-');

      rows.push({
        itemId: item.id,
        productName: item.productName,
        lwin: lwin18,
        matchedName: best.displayName,
        score,
        verdict: vintage ? 'Matched' : 'Matched, but no vintage in the name',
      });

      if (!dryRun) {
        await db
          .update(logisticsShipmentItems)
          .set({
            lwin: lwin18,
            vintage: vintage ?? undefined,
            bottleSizeMl: sizeMl,
          })
          .where(eq(logisticsShipmentItems.id, item.id));

        applied += 1;
      }
    }

    return {
      dryRun,
      considered: items.length,
      applied,
      needsReview: rows.filter((row) => !row.lwin).length,
      rows,
    };
  });

export default adminAutoMatchLwins;
