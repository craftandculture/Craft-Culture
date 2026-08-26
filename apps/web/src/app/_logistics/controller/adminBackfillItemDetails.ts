import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import isValidHsCode from '../utils/isValidHsCode';

/** Terms that make a wine sparkling wherever they appear */
const SPARKLING_TERMS = [
  'champagne',
  'sparkling',
  'cava',
  'prosecco',
  'cremant',
  'crémant',
  'sekt',
  'spumante',
  'franciacorta',
  'petillant',
  'pétillant',
];

/**
 * Terms suggesting a line is not still or sparkling wine.
 *
 * Matched on whole words, because "port" inside "Portugal" and "Porto" would
 * otherwise pull ordinary Douro wine out of the wine codes.
 *
 * These are flagged rather than skipped: on these shipments everything is wine
 * or sparkling, so leaving a line blank helps nobody. They are named in the
 * result so anything genuinely fortified or spirituous gets corrected by hand.
 */
const NOT_WINE_TERMS = [
  'whisky',
  'whiskey',
  'rum',
  'gin',
  'vodka',
  'cognac',
  'armagnac',
  'brandy',
  'tequila',
  'mezcal',
  'liqueur',
  'sake',
  'vermouth',
  'port',
  'sherry',
  'madeira',
];

/**
 * Fill in the region and HS code a line can be worked out from
 *
 * Two hundred and fifty lines is not work to do by hand, and both of these are
 * derivable. The region is already recorded against the wine in the LWIN
 * reference, so a mapped line knows its own region whether or not anyone typed
 * it. The HS code follows from what the wine is.
 *
 * Region is filled first because the HS rules read it: "Champagne" in a region
 * settles sparkling where the product name alone does not.
 *
 * The HS code copies whatever the shipment already uses for that kind of line
 * rather than defaulting to the generic heading. The document extractor warns
 * against defaulting everything to 22042100 because national subheadings —
 * 22042143 and its like — are what customs actually want, and a shipment whose
 * invoice carried them has already answered the question for its own lines.
 *
 * Where the shipment offers no precedent the generic heading is used and said
 * so, since a blank helps nobody and a stated assumption can be corrected.
 */
const adminBackfillItemDetails = adminProcedure
  .input(
    z.object({
      shipmentId: z.string().uuid(),
      /** Report what would change without writing anything */
      dryRun: z.boolean().default(false),
    }),
  )
  .mutation(async ({ input }) => {
    const { shipmentId, dryRun } = input;

    // Region, country and producer, taken from the LWIN reference against the
    // seven digits at the front of each item's LWIN.
    const fromReference = await db.execute<{
      id: string;
      region: string | null;
      country: string | null;
      producer: string | null;
    }>(sql`
      SELECT
        i.id,
        w.region,
        w.country,
        COALESCE(w.producer_name, w.producer_title) AS producer
      FROM logistics_shipment_items i
      JOIN lwin_wines w ON w.lwin = SUBSTRING(i.lwin FROM 1 FOR 7)
      WHERE i.shipment_id = ${shipmentId}
        AND i.lwin ~ '^[0-9]{7}'
        AND (
          i.region IS NULL OR TRIM(i.region) = ''
          OR i.country_of_origin IS NULL OR TRIM(i.country_of_origin) = ''
          OR i.producer IS NULL OR TRIM(i.producer) = ''
        )
    `);

    const referenceRows = Array.from(fromReference);
    let regionsFilled = 0;

    for (const row of referenceRows) {
      const set: Record<string, unknown> = { updatedAt: new Date() };

      if (row.region) set.region = row.region;
      if (row.country) set.countryOfOrigin = row.country;
      if (row.producer) set.producer = row.producer;

      // Only the empty fields are written, so a correction someone made by
      // hand is never overwritten by the reference.
      if (Object.keys(set).length === 1) continue;

      regionsFilled += 1;

      if (!dryRun) {
        await db
          .update(logisticsShipmentItems)
          .set(set)
          .where(
            and(
              eq(logisticsShipmentItems.id, row.id),
              or(
                isNull(logisticsShipmentItems.region),
                eq(logisticsShipmentItems.region, ''),
                isNull(logisticsShipmentItems.countryOfOrigin),
                eq(logisticsShipmentItems.countryOfOrigin, ''),
                isNull(logisticsShipmentItems.producer),
                eq(logisticsShipmentItems.producer, ''),
              ),
            ),
          );
      }
    }

    // Re-read, so the HS pass sees the regions just written.
    const items = await db
      .select()
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, shipmentId));

    /**
     * The codes this shipment already uses, by kind.
     *
     * A line without a code sits among lines that have one, and those came off
     * the supplier's own invoice. Copying the subheading already in use beats
     * inventing the generic heading, which the extractor is explicit about not
     * doing.
     */
    const precedent = { sparkling: '', still: '' };

    for (const item of items) {
      if (!isValidHsCode(item.hsCode)) continue;

      const text = `${item.productName} ${item.region ?? ''}`.toLowerCase();
      const kind = SPARKLING_TERMS.some((term) => text.includes(term))
        ? 'sparkling'
        : 'still';

      // The most specific wins: an eight-digit subheading says more than a
      // six-digit heading, and a generic 22042100 says least of all.
      const current = precedent[kind];
      const candidate = item.hsCode!.trim();

      if (
        !current ||
        (current === '22042100' && candidate !== '22042100') ||
        candidate.length > current.length
      ) {
        precedent[kind] = candidate;
      }
    }

    let hsFilled = 0;
    let hsSkipped = 0;
    let hsFromPrecedent = 0;
    /** Generic headings replaced by the shipment's own subheading */
    let upgraded = 0;
    const skippedExamples: string[] = [];

    for (const item of items) {
      const existing = (item.hsCode ?? '').trim();

      // A word in this column is not a code. Anything that is not digits is
      // replaced rather than respected.
      //
      // A generic 22042100 is also replaced where the shipment's own invoice
      // used a subheading, because that is the code customs want and an
      // earlier run of this pass wrote the generic before it knew better.
      const isGenericOverPrecedent =
        existing === '22042100' &&
        !!precedent.still &&
        precedent.still !== '22042100';

      if (isValidHsCode(item.hsCode) && !isGenericOverPrecedent) continue;

      if (isGenericOverPrecedent) upgraded += 1;

      const text = `${item.productName} ${item.region ?? ''}`.toLowerCase();

      // Whole words only: "port" inside "Portugal" is not a fortified wine.
      const looksNotWine = NOT_WINE_TERMS.some((term) =>
        new RegExp(`\\b${term}\\b`, 'i').test(text),
      );

      if (looksNotWine) {
        hsSkipped += 1;

        if (skippedExamples.length < 8) skippedExamples.push(item.productName);
      }

      const isSparkling = SPARKLING_TERMS.some((term) => text.includes(term));
      const fromShipment = isSparkling
        ? precedent.sparkling
        : precedent.still;
      const hsCode = fromShipment || (isSparkling ? '22041000' : '22042100');

      if (fromShipment) hsFromPrecedent += 1;

      hsFilled += 1;

      if (!dryRun) {
        await db
          .update(logisticsShipmentItems)
          .set({ hsCode, updatedAt: new Date() })
          .where(eq(logisticsShipmentItems.id, item.id));
      }
    }

    // A bare count of what changed cannot explain a run that changed nothing,
    // and "0 filled" against a progress bar reading half is exactly the case
    // where someone needs to know which of several reasons applied.
    const withLwin = items.filter(
      (item) => (item.lwin ?? '').trim() !== '',
    ).length;
    const withNumericLwin = items.filter((item) =>
      /^[0-9]{7}/.test((item.lwin ?? '').trim()),
    ).length;
    const hsAlreadySet = items.filter((item) =>
      isValidHsCode(item.hsCode),
    ).length;
    /** Non-empty but not a code — "Wine" and its like */
    const hsInvalid = items.filter(
      (item) =>
        (item.hsCode ?? '').trim() !== '' && !isValidHsCode(item.hsCode),
    ).length;
    const regionAlreadySet = items.filter(
      (item) => (item.region ?? '').trim() !== '',
    ).length;

    return {
      dryRun,
      diagnostics: {
        /** Lines on this shipment */
        total: items.length,
        /** Lines carrying any LWIN at all */
        withLwin,
        /** Lines whose LWIN starts with seven digits, the only ones the
            reference can be joined on — a supplier code cannot be */
        withNumericLwin,
        /** Lines the reference actually had a row for */
        referenceMatches: referenceRows.length,
        hsAlreadySet,
        hsInvalid,
        regionAlreadySet,
      },
      regionsFilled,
      hsFilled,
      /** Of those, taken from a code the shipment already used */
      hsFromPrecedent,
      /** Generic 22042100 replaced by the shipment's own subheading */
      upgraded,
      /** The codes copied, so an assumption is visible rather than implied */
      precedent,
      /** Given a wine code but worth checking — the name suggests otherwise */
      hsFlagged: hsSkipped,
      flaggedExamples: skippedExamples,
      total: items.length,
    };
  });

export default adminBackfillItemDetails;
