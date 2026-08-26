import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import isValidHsCode from '../utils/isValidHsCode';

/** The codes the HS menu offers — the only ones a line should end on */
const MENU_CODES = new Set([
  '22042100',
  '22041000',
  '22084000',
  '22083000',
  '22030000',
  '22082000',
  '22089090',
  '22085000',
  '22087000',
  '22086000',
  '22060000',
]);

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
 * Every line ends on one of the codes in the HS menu. Those eleven are what
 * this business declares on, and a column mixing them with an invoice's
 * national subheadings — 22042143, 22041011 — cannot be read at a glance or
 * matched against a rate card.
 *
 * So a subheading is pulled back to its heading rather than kept: the first
 * five digits say which of the menu's codes it belongs under, which is a
 * stronger signal than the product name and survives a wine whose name gives
 * nothing away.
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

    let hsFilled = 0;
    let hsSkipped = 0;
    /** Subheadings pulled back onto one of the menu's codes */
    let normalised = 0;
    const skippedExamples: string[] = [];

    for (const item of items) {
      const existing = (item.hsCode ?? '').trim();

      // The eleven codes in the menu are the ones this business declares on.
      // An invoice's national subheading — 22042143, 22041011 — is more
      // specific than anything anyone here will maintain, and a column mixing
      // both cannot be read at a glance or matched against a rate card.
      //
      // A subheading is pulled back to its heading rather than left alone: the
      // first five digits say which of the menu's codes it belongs under.
      const isOffMenu = isValidHsCode(existing) && !MENU_CODES.has(existing);

      if (isValidHsCode(item.hsCode) && !isOffMenu) continue;

      if (isOffMenu) normalised += 1;

      const text = `${item.productName} ${item.region ?? ''}`.toLowerCase();

      // Whole words only: "port" inside "Portugal" is not a fortified wine.
      const looksNotWine = NOT_WINE_TERMS.some((term) =>
        new RegExp(`\\b${term}\\b`, 'i').test(text),
      );

      if (looksNotWine) {
        hsSkipped += 1;

        if (skippedExamples.length < 8) skippedExamples.push(item.productName);
      }

      // A code already on the line says more than its name does: 22041011 is
      // a sparkling subheading whatever the product is called.
      const fromExisting = existing.startsWith('22041')
        ? '22041000'
        : existing.startsWith('22042')
          ? '22042100'
          : '';

      const hsCode =
        fromExisting ||
        (SPARKLING_TERMS.some((term) => text.includes(term))
          ? '22041000'
          : '22042100');

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
      /** Of those, off-menu subheadings pulled back onto a menu code */
      normalised,
      /** Given a wine code but worth checking — the name suggests otherwise */
      hsFlagged: hsSkipped,
      flaggedExamples: skippedExamples,
      total: items.length,
    };
  });

export default adminBackfillItemDetails;
