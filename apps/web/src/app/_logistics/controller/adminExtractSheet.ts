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
      'Heading holding a BOTTLE count. A quantity column beside a per-bottle price is a bottle count.',
    ),
  cases: z
    .string()
    .optional()
    .describe('Heading holding a CASE count, only if the sheet states cases'),
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
  lwin: z.string().optional().describe('Heading holding a LWIN or product code'),
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
      if (skipHint && rawName.toLowerCase().includes(skipHint)) {
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

      return [
        {
          productName: rawName,
          lwin: pick(row, map.lwin) ? String(pick(row, map.lwin)) : undefined,
          vintage: parsed.vintage ?? undefined,
          bottleSize: parsed.bottleSizeMl
            ? `${parsed.bottleSizeMl}ml`
            : productSizeL
              ? `${Math.round(productSizeL * 1000)}ml`
              : undefined,
          bottles,
          productSizeL,
          totalSizeL,
          cases: toNumber(pick(row, map.cases)),
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

    return {
      sheetName: sheet.sheetName,
      currency: map.currency?.toUpperCase() ?? 'USD',
      headers: sheet.headers,
      columnMap: map,
      rowsRead: sheet.rows.length,
      skippedNonItemRows: skipped,
      items,
      totalBottles: items.reduce((sum, item) => sum + (item.bottles ?? 0), 0),
    };
  });

export default adminExtractSheet;
