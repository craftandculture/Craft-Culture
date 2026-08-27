import { anthropic } from '@ai-sdk/anthropic';
import { TRPCError } from '@trpc/server';
import { generateObject } from 'ai';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';

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

  const cleaned = String(value)
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

    const items = sheet.rows.flatMap((row) => {
      const rawName = String(pick(row, map.productName) ?? '').trim();

      if (!rawName) return [];

      // Shipping and totals sit in the same column as the wines.
      if (SUMMARY_ROW.test(rawName) || (skipHint && rawName.toLowerCase().includes(skipHint))) {
        skipped += 1;

        return [];
      }

      const parsed = parseWineName(rawName);
      const productSizeL = toNumber(pick(row, map.productSizeL));
      const totalSizeL = toNumber(pick(row, map.totalSizeL));

      const bottles =
        toNumber(pick(row, map.bottles)) ??
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

      return [
        {
          productName: rawName,
          lwin,
          supplierSku,
          vintage: parsed.vintage ?? undefined,
          bottleSize: parsed.bottleSizeMl
            ? `${parsed.bottleSizeMl}ml`
            : productSizeL
              ? `${Math.round(productSizeL * 1000)}ml`
              : undefined,
          bottles,
          productSizeL,
          totalSizeL,
          cases: toNumber(pick(row, map.cases)) ?? toNumber(pick(row, map.caseCount)),
          bottlesPerCase: toNumber(pick(row, map.bottlesPerCase)),
          unitPrice: toNumber(pick(row, map.unitPrice)),
          total: toNumber(pick(row, map.lineTotal)),
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

    return {
      sheetName: sheet.sheetName,
      currency: headerCurrency ?? map.currency?.toUpperCase() ?? 'USD',
      currencySource: headerCurrency ? 'headings' : map.currency ? 'read' : 'assumed',
      headers: sheet.headers,
      columnMap: map,
      rowsRead: sheet.rows.length,
      skippedNonItemRows: skipped,
      items,
      totalBottles: items.reduce((sum, item) => sum + (item.bottles ?? 0), 0),
    };
  });

export default adminExtractSheet;
