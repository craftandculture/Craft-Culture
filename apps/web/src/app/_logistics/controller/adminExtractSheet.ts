import { anthropic } from '@ai-sdk/anthropic';
import { TRPCError } from '@trpc/server';
import { generateObject } from 'ai';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';

import parseDeclaredTotals from '../utils/parseDeclaredTotals';
import parsePackFormat from '../utils/parsePackFormat';
import parseWineName from '../utils/parseWineName';
import readInvoiceSheet from '../utils/readInvoiceSheet';

/**
 * Which of the supplier's column headings mean what.
 *
 * The model is asked for this and nothing else. It is a handful of strings
 * whatever the sheet's size, so it cannot truncate — which is the whole point
 * of doing it this way rather than asking for the rows themselves.
 */
const columnMapSchema = z.object({
  productName: z
    .string()
    .describe('Heading holding the wine name, exactly as printed'),
  bottles: z
    .string()
    .optional()
    .describe(
      'Heading holding a BOTTLE count. A quantity column beside a per-bottle price is a bottle count. Where a sheet splits quantity into two adjacent columns headed "cs" and "bt" — or "Cases" and "Bottles" — this is the "bt" one: a row with a figure there is loose bottles out of a pack, not cases.',
    ),
  cases: z
    .string()
    .optional()
    .describe(
      'Heading holding a CASE count, only if the sheet states cases. Where quantity is split into "cs" and "bt" columns this is the "cs" one, and a row with a figure only under "bt" has no cases at all.',
    ),
  productSizeL: z
    .string()
    .optional()
    .describe('Heading holding the size of one bottle in litres'),
  totalSizeL: z
    .string()
    .optional()
    .describe('Heading holding total litres for the line'),
  bottlesPerCase: z
    .string()
    .optional()
    .describe('Heading holding bottles per case, if the sheet states a pack'),
  format: z
    .string()
    .optional()
    .describe(
      'Heading holding the pack as text — "6x75cl", "12 x 750ml", "1x300cl". This states BOTH bottles per case and the bottle size; map it here rather than as a size or a quantity.',
    ),
  vintage: z
    .string()
    .optional()
    .describe(
      'Heading holding the vintage year. Map it whenever the sheet has one, even though many wine names also carry a year.',
    ),
  unitPrice: z
    .string()
    .optional()
    .describe('Heading holding the price of one bottle'),
  lineTotal: z.string().optional().describe('Heading holding the line total'),
  hsCode: z.string().optional().describe('Heading holding the HS/commodity code'),
  countryOfOrigin: z.string().optional().describe('Heading holding the origin'),
  lwin: z
    .string()
    .optional()
    .describe(
      'Heading holding a LWIN — a 7- or 11-digit wine number, or an 18-character LWIN. Not a supplier reference.',
    ),
  supplierSku: z
    .string()
    .optional()
    .describe(
      "Heading holding the supplier's OWN product reference, e.g. a W-code like W3200124",
    ),
  caseCount: z
    .string()
    .optional()
    .describe(
      'Heading holding the number of physical cases or cartons, e.g. "Nombre de colis"',
    ),
  currency: z
    .string()
    .length(3)
    .optional()
    .describe('ISO currency the money columns are in, e.g. EUR'),
  /** Rows that are not wine — shipping, totals, subtotals */
  nonItemRowHint: z
    .string()
    .optional()
    .describe(
      'A word appearing in the product column of rows that are charges rather than wine, e.g. "Shipping"',
    ),
});

/**
 * The currency a supplier prints in their own headings.
 *
 * "TotalPrice (€)" says euros more reliably than any inference, so the symbol
 * in the headings wins over the model's reading. Getting this wrong is how a
 * euro invoice ends up stored as dollars with nothing recording the swap.
 */
const currencyFromHeaders = (headers: string[]) => {
  const text = headers.join(' ');

  if (/€|\bEUR\b/i.test(text)) return 'EUR';
  if (/£|\bGBP\b/i.test(text)) return 'GBP';
  if (/\bCHF\b/i.test(text)) return 'CHF';
  if (/\bAED\b/i.test(text)) return 'AED';
  if (/\$|\bUSD\b/.test(text)) return 'USD';

  return null;
};

/**
 * Labels that mark a row as a summary or a charge rather than a wine.
 *
 * The model is asked for a hint too, but this does not depend on it. One
 * supplier put "TOTAL" in the product column and the whole invoice arrived as
 * a 66th line carrying 145 bottles and EUR 53,492.61 — the shipment's own
 * total, counted twice. A foot row is structural, so it is caught in code.
 */
const SUMMARY_ROW =
  /^(sub[-\s]?total|totals?|totaux|grand total|invoice total|somme|balance|vat|tva|taxes?|shipping|freight|transport|carriage|insurance|handling|discount|deposit)\b/i;

/** A LWIN is digits — a supplier reference like "W3200124" is not one */
const looksLikeLwin = (value: string) => /^\d{7}(\d{4}\d{2}\d{5})?$/.test(value.replace(/[-\s]/g, ''));

/** Cell → number, tolerating currency symbols, thousands separators and commas */
const toNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;

  const text = String(value).trim();

  // A cell holding TWO numbers is not a quantity. Stripping the letters from
  // "6x75cl" yields 675, which then reads as a bottle size — the pack string
  // has to be rejected here and parsed properly elsewhere.
  const groups = text.replace(/[,\s]/g, '').match(/\d+(?:\.\d+)?/g) ?? [];
  if (groups.length !== 1) return undefined;

  const cleaned = text
    .replace(/[^\d.,-]/g, '')
    .replace(/,(?=\d{3}\b)/g, '')
    .replace(',', '.');

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Read a supplier's spreadsheet of the same invoice
 *
 * Suppliers often send the workbook alongside the PDF. It is the better source:
 * the figures are exact rather than read off a page, and the rows can be walked
 * in code.
 *
 * So the model is asked only which heading means what — a dozen strings,
 * regardless of whether the sheet has twelve rows or twelve hundred. Every row
 * is then parsed deterministically. A 163-line invoice truncated the PDF
 * extraction because the model had to reproduce every line as JSON; nothing
 * here grows with the row count.
 */
const adminExtractSheet = adminProcedure
  .input(
    z.object({
      /** base64 workbook — .xlsx, .xls or .csv */
      file: z.string().min(1),
      fileName: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    let sheet;

    try {
      sheet = readInvoiceSheet(input.file);
    } catch (error) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          error instanceof Error ? error.message : 'Could not read that workbook',
      });
    }

    if (sheet.rows.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Found headings in "${sheet.sheetName}" but no rows beneath them`,
      });
    }

    // Headings plus a few rows is all the mapper needs, and keeps the prompt
    // the same size for any workbook.
    const sample = sheet.rows.slice(0, 5);

    const { object: map } = await generateObject({
      model: anthropic('claude-sonnet-4-6'),
      schema: columnMapSchema,
      maxOutputTokens: 2048,
      system:
        'You map a supplier spreadsheet\'s column headings onto known fields. Return headings exactly as given. Omit a field when no column holds it — never guess.',
      messages: [
        {
          role: 'user',
          content: `Headings: ${JSON.stringify(sheet.headers)}\n\nFirst rows:\n${JSON.stringify(sample, null, 1)}`,
        },
      ],
    });

    const pick = (row: Record<string, unknown>, heading?: string) =>
      heading ? row[heading] : undefined;

    const skipHint = map.nonItemRowHint?.trim().toLowerCase();
    let skipped = 0;
    /**
     * The rows that are not wine.
     *
     * They were counted and thrown away, which discarded the supplier's own
     * totals — the one figure in the file that can check everything parsed out
     * of it. A totals row usually has nothing in the name column at all, so
     * both kinds are kept: the labelled "TOTAL" and the unlabelled foot.
     */
    const summaryRows: Record<string, unknown>[] = [];
    /**
     * Rows carrying nothing in the column mapped as the product name.
     *
     * "0 lines" on a workbook full of wine is almost always this: the mapper
     * named a heading that is not the one the names are in, and every row then
     * looks blank. Counted apart from deliberate skips so the difference
     * between "mapped the wrong column" and "these were summary rows" is
     * visible rather than guessed at.
     */
    let unnamed = 0;

    const items = sheet.rows.flatMap((row) => {
      const rawName = String(pick(row, map.productName) ?? '').trim();

      if (!rawName) {
        unnamed += 1;
        summaryRows.push(row);

        return [];
      }

      // Shipping and totals sit in the same column as the wines.
      if (SUMMARY_ROW.test(rawName) || (skipHint && rawName.toLowerCase().includes(skipHint))) {
        skipped += 1;
        summaryRows.push(row);

        return [];
      }

      const parsed = parseWineName(rawName);
      const packFormat = parsePackFormat(pick(row, map.format));
      const rowWarnings: string[] = [];

      /**
       * A size no bottle has is not a size.
       *
       * 187ml (piccolo) to 15,000ml (Nebuchadnezzar) covers everything wine is
       * sold in. Anything outside it came from a misread column — 75cl read as
       * 75 litres gave 75,000ml — and storing it silently is how an absurd
       * figure reaches landed cost. Refuse it and say so.
       */
      const plausibleSize = (ml: number | null | undefined) => {
        if (ml == null) return undefined;
        if (ml >= 187 && ml <= 15000) return ml;
        rowWarnings.push(`bottle size read as ${ml}ml — ignored, no bottle is that size`);

        return undefined;
      };
      const productSizeL = toNumber(pick(row, map.productSizeL));
      // The size column is labelled litres but suppliers write centilitres (75,
      // 150) or millilitres (750, 1500) just as often. Taking it literally read
      // a 75cl bottle as 75 LITRES and stamped it 75000ml. Judge by magnitude:
      // no wine bottle is 20-600 litres, and none is under 100ml.
      const sizeMl =
        productSizeL == null || productSizeL <= 0
          ? null
          : productSizeL <= 6
            ? Math.round(productSizeL * 1000)
            : productSizeL <= 600
              ? Math.round(productSizeL * 10)
              : Math.round(productSizeL);
      const totalSizeL = toNumber(pick(row, map.totalSizeL));

      const casesOnRow =
        toNumber(pick(row, map.cases)) ?? toNumber(pick(row, map.caseCount));
      const perCase =
        toNumber(pick(row, map.bottlesPerCase)) ??
        packFormat.bottlesPerCase ??
        undefined;

      // Cases carry bottles too. Counting only the loose-bottle column reported
      // a 14-line shipment as 10 bottles, because every full case read as zero.
      const bottles =
        toNumber(pick(row, map.bottles)) ??
        (casesOnRow && perCase ? casesOnRow * perCase : undefined) ??
        (productSizeL && totalSizeL && productSizeL > 0
          ? Math.round(totalSizeL / productSizeL)
          : undefined);

      // A supplier reference in the LWIN column is a reference, not a LWIN.
      // Writing "W3200124" into lwin would look mapped while matching nothing.
      const rawCode = pick(row, map.lwin)
        ? String(pick(row, map.lwin)).trim()
        : '';
      const rawSku = pick(row, map.supplierSku)
        ? String(pick(row, map.supplierSku)).trim()
        : '';

      const lwin = rawCode && looksLikeLwin(rawCode) ? rawCode : undefined;
      const supplierSku = rawSku || (rawCode && !lwin ? rawCode : undefined);

      if (perCase != null && (perCase < 1 || perCase > 24)) {
        rowWarnings.push(`pack of ${perCase} — outside 1-24, check the column`);
      }

      const vintageOnRow =
        toNumber(pick(row, map.vintage)) ?? parsed.vintage ?? undefined;
      if (vintageOnRow == null) rowWarnings.push('no vintage');

      /*
        A line total that is not its own parts suggests a quantity or a price
        came from the wrong column — but only if we know which basis the price
        is on, and the document rarely says. Wilkinson head theirs "Price/Case"
        while others quote per bottle, so the total is checked against BOTH and
        flagged only when it matches neither. Checking one basis alone flagged
        thirteen lines of a fourteen-line invoice that was entirely correct,
        and a warning that cries wolf is worse than none.
      */
      const lineTotal = toNumber(pick(row, map.lineTotal));
      const unitPrice = toNumber(pick(row, map.unitPrice));
      if (lineTotal != null && lineTotal > 0 && unitPrice != null) {
        const bases = [
          bottles ? unitPrice * bottles : null,
          casesOnRow ? unitPrice * casesOnRow : null,
          // a per-case price billed for loose bottles out of that case, which
          // is how every bottle-billed line on a Wilkinson invoice reads
          bottles && perCase ? (unitPrice / perCase) * bottles : null,
          unitPrice,
        ].filter((v): v is number => v != null && v > 0);

        const matches = bases.some(
          (v) => Math.abs(v - lineTotal) / lineTotal <= 0.02,
        );

        if (bases.length > 0 && !matches) {
          rowWarnings.push(
            `value ${lineTotal} matches neither ${unitPrice} per bottle nor per case`,
          );
        }
      }

      return [
        {
          productName: rawName,
          warnings: rowWarnings.length ? rowWarnings : undefined,
          lwin,
          supplierSku,
          // the sheet's own column beats a year guessed out of the wine name
          vintage: vintageOnRow,
          bottleSize: (() => {
            const ml =
              plausibleSize(packFormat.bottleSizeMl) ??
              plausibleSize(parsed.bottleSizeMl) ??
              plausibleSize(sizeMl);

            return ml ? `${ml}ml` : undefined;
          })(),
          bottles,
          productSizeL,
          totalSizeL,
          cases: casesOnRow,
          bottlesPerCase: perCase,
          unitPrice,
          total: lineTotal,
          hsCode: pick(row, map.hsCode)
            ? String(pick(row, map.hsCode)).replace(/\D/g, '')
            : undefined,
          countryOfOrigin: pick(row, map.countryOfOrigin)
            ? String(pick(row, map.countryOfOrigin))
            : undefined,
        },
      ];
    });

    const headerCurrency = currencyFromHeaders(sheet.headers);

    /*
      What the money is in, said rather than assumed.

      The cell format is the sheet's own statement and outranks everything: a
      Wilkinson invoice heads its columns "Price/Case" and "Total Price" and
      names no currency anywhere on its face, so the model was left to guess
      and guessed dollars — £31,018.30 of wine was imported as $31,018.30, the
      FX row never appeared because the shipment looked American, and every
      landed cost built on it was a quarter light.

      Where nothing states it, the currency is returned as null. Defaulting to
      USD is what made that failure silent, and a blank the importer refuses is
      better than a figure nobody chose.
    */
    const currency =
      sheet.formatCurrency ?? headerCurrency ?? map.currency?.toUpperCase() ?? null;

    const currencySource = sheet.formatCurrency
      ? 'cell format'
      : headerCurrency
        ? 'headings'
        : map.currency
          ? 'read from the sheet'
          : 'unknown';

    const declared = parseDeclaredTotals({
      summaryRows,
      notes: sheet.notes,
      columns: {
        cases: map.cases ?? map.caseCount,
        bottles: map.bottles,
        value: map.lineTotal,
      },
      toNumber,
    });

    const totalBottles = items.reduce((sum, item) => sum + (item.bottles ?? 0), 0);

    return {
      sheetName: sheet.sheetName,
      currency,
      currencySource,
      headers: sheet.headers,
      columnMap: map,
      rowsRead: sheet.rows.length,
      skippedNonItemRows: skipped,
      items,
      totalBottles,
      /** What the supplier says they shipped, to be set beside what we read */
      declared,
      /** The same figures as we parsed them, so the two can be compared */
      computed: {
        cases: items.reduce((sum, item) => sum + (item.cases ?? 0), 0),
        /**
         * Bottles billed loose, which is what a "bt" column totals.
         *
         * Compared against the document's own loose-bottle total, not against
         * every bottle in the shipment — those are different quantities and
         * setting them side by side would report a disagreement on a correct
         * invoice.
         */
        looseBottles: items.reduce(
          (sum, item) => sum + (item.cases ? 0 : (item.bottles ?? 0)),
          0,
        ),
        bottles: totalBottles,
        value: items.reduce((sum, item) => sum + (item.total ?? 0), 0),
      },
      /**
       * What the mapper decided, so a run that finds nothing can be argued
       * with rather than merely repeated.
       */
      diagnostics: {
        headers: sheet.headers,
        rowsScanned: sheet.rows.length,
        unnamed,
        mappedTo: {
          productName: map.productName,
          bottles: map.bottles,
          cases: map.cases,
          unitPrice: map.unitPrice,
          lineTotal: map.lineTotal,
        },
      },
    };
  });

export default adminExtractSheet;
