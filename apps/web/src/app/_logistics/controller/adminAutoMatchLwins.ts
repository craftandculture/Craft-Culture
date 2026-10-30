import { TRPCError } from '@trpc/server';
import { and, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { MIN_MARGIN, MIN_SCORE } from '../constants/lwinMatching';
import askWinelabsForLine from '../data/askWinelabsForLine';
import searchRegister from '../data/searchRegister';
import decideLwinMatch from '../utils/decideLwinMatch';
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
  /** Who chose the LWIN written: Wine Labs, our LWIN register, or nobody yet */
  source: 'winelabs' | 'register' | null;
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
 *
 * Wine Labs is asked first (about 8 credits a line) and its answer is taken
 * when the line reads as the wine it names. Otherwise our register decides,
 * as before, with Wine Labs' answer offered first among the options. When
 * Wine Labs cannot answer (no credits, the monthly cap, an outage), the rest
 * of the run uses the register alone.
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
        // The producer is searched with the name; the rest is read so the
        // shape of the line is in hand
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
    // Set once Wine Labs fails, so a run out of credits stops asking
    let winelabsError: string | null = null;

    for (const item of items) {
      const parsed = parseWineName(item.productName);

      /*
        The producer is part of the wine's name, even when the invoice puts it
        on a line of its own. Read from the name alone, "Meursault" from
        Domaine Antoine Jobard scored every Meursault in the database the same
        and came back "too close to choose" between three Chateau de Meursault
        records. With the producer in front, "Domaine Antoine Jobard
        Meursault" has one clear match.
      */
      const producer = item.producer?.trim() ?? '';
      const withProducer =
        producer && !parsed.searchName.toLowerCase().includes(producer.toLowerCase())
          ? `${producer} ${parsed.searchName}`
          : parsed.searchName;

      if (parsed.searchName.length < 3) {
        rows.push({
          itemId: item.id,
          productName: item.productName,
          lwin: null,
          matchedName: null,
          score: 0,
          verdict: 'Nothing searchable in the product name',
          source: null,
          candidates: [],
        });
        continue;
      }

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
        The record a line matched becomes the line: name, producer, region and
        country (Kevin, 19 October 2026). Matching once wrote the code, the
        vintage and the size and stopped there, which left lines with a green
        LWIN and no producer, region or country, the fields the catalogue, the
        stock explorer and every quote read. A supplier's "Meursault" beside a
        LWIN for a named domaine said two things.
      */
      const writeMatch = async (
        lwin18: string,
        record: {
          displayName: string;
          producerTitle?: string | null;
          producerName?: string | null;
          subRegion?: string | null;
          region?: string | null;
          country?: string | null;
        },
      ) => {
        if (dryRun) return;
        const matchedProducer = [record.producerTitle, record.producerName].filter(Boolean).join(' ');
        const region = record.subRegion ?? record.region;
        await db
          .update(logisticsShipmentItems)
          .set({
            lwin: lwin18,
            vintage: vintage ?? undefined,
            bottleSizeMl: sizeMl,
            productName: record.displayName,
            ...(matchedProducer ? { producer: matchedProducer } : {}),
            ...(region ? { region } : {}),
            ...(record.country ? { countryOfOrigin: record.country } : {}),
          })
          .where(eq(logisticsShipmentItems.id, item.id));
        applied += 1;
      };

      // Wine Labs first: it reads a messy supplier line better than a trigram search
      let winelabs: Awaited<ReturnType<typeof askWinelabsForLine>> = null;
      if (!winelabsError) {
        try {
          winelabs = await askWinelabsForLine(withProducer, item.productName, vintage);
        } catch (error) {
          winelabsError = error instanceof Error ? error.message : 'Wine Labs did not answer';
        }
      }

      const lineText = `${withProducer} ${item.productName}`;
      const winelabsAnswer = winelabs?.name
        ? {
            lwin7: winelabs.lwin7,
            fit: winelabs.fit,
            // The register leaves some producers blank; its name then starts with one
            producer: winelabs.record?.producerName || winelabs.name.split(',')[0]?.trim() || null,
          }
        : null;

      // Wine Labs alone is enough when its answer reads as the line and names its producer
      if (winelabs && decideLwinMatch(lineText, winelabsAnswer, null)) {
        const lwin18 = compose(winelabs.lwin7);
        rows.push({
          itemId: item.id,
          productName: item.productName,
          lwin: lwin18,
          matchedName: winelabs.name,
          score: winelabs.fit,
          verdict: vintage ? 'Matched by Wine Labs' : 'Matched by Wine Labs, but no vintage in the name',
          source: 'winelabs',
          candidates: [],
        });
        await writeMatch(lwin18, winelabs.record ?? { displayName: winelabs.name });
        continue;
      }

      // Ranked in the database rather than in memory: 208k records per line,
      // 163 lines, and only the top few ever matter.
      const candidates = await searchRegister(parsed.searchName, withProducer, Boolean(producer));

      const best = candidates[0];
      const runnerUp = candidates[1];
      const score = Number(best?.score ?? 0);
      const margin = score - Number(runnerUp?.score ?? 0);

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

      // Wine Labs' answer leads the options even when it did not read as the line
      if (winelabs?.name && !options.some((option) => option.lwin18 === compose(winelabs!.lwin7))) {
        options.unshift({
          lwin18: compose(winelabs.lwin7),
          displayName: winelabs.name,
          detail: ['Wine Labs suggests', winelabs.record?.subRegion ?? winelabs.record?.region, winelabs.lwin7]
            .filter(Boolean)
            .join(' · '),
          score: winelabs.fit,
        });
      }
      const winelabsNote = winelabs?.name ? `; Wine Labs suggests "${winelabs.name}", which the line does not clearly name` : '';

      if (!best || score < MIN_SCORE) {
        rows.push({
          itemId: item.id,
          productName: item.productName,
          lwin: null,
          matchedName: best?.displayName ?? null,
          score,
          verdict: `No wine in our register resembles this closely enough${winelabsNote}`,
          source: null,
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
              : `Too close to "${runnerUp?.displayName ?? 'another wine'}" to choose${winelabsNote}`,
          source: null,
          candidates: options,
        });
        continue;
      }

      // A clear winner in the register is still not filed when Wine Labs named another wine
      if (!decideLwinMatch(lineText, winelabsAnswer, best.lwin)) {
        rows.push({
          itemId: item.id,
          productName: item.productName,
          lwin: null,
          matchedName: best.displayName,
          score,
          verdict: `Wine Labs ("${winelabs?.name}") and our register ("${best.displayName}") name different wines`,
          source: null,
          candidates: options,
        });
        continue;
      }

      const lwin18 = compose(best.lwin);
      const agrees = winelabs?.lwin7 === best.lwin;

      rows.push({
        itemId: item.id,
        productName: item.productName,
        lwin: lwin18,
        matchedName: best.displayName,
        score,
        verdict: agrees
          ? 'Matched: Wine Labs and our register agree'
          : vintage
            ? 'Matched by our register'
            : 'Matched by our register, but no vintage in the name',
        source: agrees ? 'winelabs' : 'register',
        candidates: options,
      });

      await writeMatch(lwin18, best);
    }

    return {
      dryRun,
      considered: items.length,
      applied,
      needsReview: rows.filter((row) => !row.lwin).length,
      byWinelabs: rows.filter((row) => row.lwin && row.source === 'winelabs').length,
      winelabsError,
      rows,
    };
  });

export default adminAutoMatchLwins;
