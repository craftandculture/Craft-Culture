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

export interface AutoMatchCandidate {
  /** Ready to write — wine, vintage, pack and size already composed */
  lwin18: string;
  displayName: string;
  /**
   * What tells this record apart from the others offered.
   *
   * Three candidates all reading "Margaux" is not a choice. LWIN's display
   * name is often just the wine, so the producer, the appellation and the
   * classification are what actually separate Chateau Margaux from every other
   * record carrying the name — and the LWIN itself separates the rest.
   */
  detail: string;
  score: number;
}

export interface AutoMatchRow {
  itemId: string;
  productName: string;
  /** The LWIN18 written, when the match was confident enough to take */
  lwin: string | null;
  matchedName: string | null;
  score: number;
  /** Why it was taken or left, in a phrase */
  verdict: string;
  /**
   * What it was choosing between, composed and ready to apply.
   *
   * Declining to guess is right — two close names are a judgement — but a
   * refusal that keeps its reasoning to itself just leaves someone searching
   * 208k records by hand for a wine the matcher already had in front of it.
   * "Too close to choose" is a question, and a question needs its options.
   */
  candidates: AutoMatchCandidate[];
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
        // Read so they are only filled where they are empty — a matcher
        // should not overwrite what a person has typed
        producer: logisticsShipmentItems.producer,
        region: logisticsShipmentItems.region,
        countryOfOrigin: logisticsShipmentItems.countryOfOrigin,
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
          candidates: [],
        });
        continue;
      }

      // Ranked in the database rather than in memory: 208k records per line,
      // 163 lines, and only the top few ever matter.
      const candidates = await db
        .select({
          lwin: lwinWines.lwin,
          displayName: lwinWines.displayName,
          producerTitle: lwinWines.producerTitle,
          producerName: lwinWines.producerName,
          wine: lwinWines.wine,
          region: lwinWines.region,
          subRegion: lwinWines.subRegion,
          country: lwinWines.country,
          classification: lwinWines.classification,
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

      // LWIN18 is wine-vintage-pack-size, and the invoice supplied the last
      // three: the vintage is in the name, the pack is what was billed, and
      // the size is stated per bottle.
      const vintage = parsed.vintage ?? item.vintage;
      const sizeMl = parsed.bottleSizeMl ?? item.bottleSizeMl ?? 750;
      const pack = item.bottlesPerCase ?? item.totalBottles ?? 1;

      const compose = (wineLwin: string) =>
        [
          wineLwin,
          String(vintage ?? 0).padStart(4, '0'),
          String(pack).padStart(2, '0'),
          String(sizeMl).padStart(5, '0'),
        ].join('-');

      /*
        Every row carries what it was choosing between, composed and ready.

        A line left unmatched is a question — "is this Chateau Margaux or one
        of the forty other wines with Margaux in the name?" — and the matcher
        had the shortlist in hand when it declined to answer. Returning only
        the refusal sent someone back to search 208k records for a wine it had
        already found.
      */
      const options = candidates.slice(0, 3).map((candidate) => {
        const producer = [candidate.producerTitle, candidate.producerName]
          .filter(Boolean)
          .join(' ');

        // Only the parts that say something the display name has not already
        const detail = [
          producer,
          candidate.wine,
          candidate.subRegion ?? candidate.region,
          candidate.country,
          candidate.classification,
          candidate.lwin,
        ]
          .filter((part): part is string => Boolean(part))
          .filter(
            (part, index, all) =>
              all.indexOf(part) === index &&
              part.toLowerCase() !== candidate.displayName.toLowerCase(),
          )
          .join(' · ');

        return {
          lwin18: compose(candidate.lwin),
          displayName: candidate.displayName,
          detail,
          score: Number(candidate.score),
        };
      });

      if (!best || score < MIN_SCORE) {
        rows.push({
          itemId: item.id,
          productName: item.productName,
          lwin: null,
          matchedName: best?.displayName ?? null,
          score,
          verdict: 'No wine resembles this closely enough',
          candidates: options,
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
          verdict:
            runnerUp?.displayName?.toLowerCase() ===
            best.displayName.toLowerCase()
              ? `${candidates.length} records share the name "${best.displayName}"`
              : `Too close to "${runnerUp?.displayName ?? 'another wine'}" to choose`,
          candidates: options,
        });
        continue;
      }

      const lwin18 = compose(best.lwin);

      rows.push({
        itemId: item.id,
        productName: item.productName,
        lwin: lwin18,
        matchedName: best.displayName,
        score,
        verdict: vintage ? 'Matched' : 'Matched, but no vintage in the name',
        candidates: options,
      });

      if (!dryRun) {
        /*
          The record is already in hand, so the wine's identity goes with it.

          Matching wrote the code, the vintage and the size and stopped there,
          which left every automatically-matched line with a green LWIN and no
          producer, region or country — the fields the catalogue, the stock
          explorer and every quote actually read. Two Chambolle lines matched
          cleanly and still arrived as a name and a number.

          Filling it here costs nothing: these columns were fetched to score
          the candidates. Only blanks are written, because a matcher has no
          business correcting a person.
        */
        const producer = [best.producerTitle, best.producerName]
          .filter(Boolean)
          .join(' ');
        const region = best.subRegion ?? best.region;

        await db
          .update(logisticsShipmentItems)
          .set({
            lwin: lwin18,
            vintage: vintage ?? undefined,
            bottleSizeMl: sizeMl,
            ...(producer && !item.producer?.trim() ? { producer } : {}),
            ...(region && !item.region?.trim() ? { region } : {}),
            ...(best.country && !item.countryOfOrigin?.trim()
              ? { countryOfOrigin: best.country }
              : {}),
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
