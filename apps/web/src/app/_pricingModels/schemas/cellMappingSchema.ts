import { z } from 'zod';

// Validates a single cell reference with optional sheet name (e.g., A1, B5, 'Sheet Name'!A1)
const singleCellRefSchema = z
  .string()
  .regex(
    /^(?:'[^']+'!)?[A-Z]+\d+$/,
    "Must be a single cell reference (e.g., A1, B5, 'Sheet'!A1)",
  );

// Validates a column range with max 10 rows and optional sheet name (e.g., A1:A10, 'Sheet'!A1:A10)
const columnRangeSchema = z
  .string()
  .regex(
    /^(?:'[^']+'!)?([A-Z]+)(\d+):([A-Z]+)(\d+)$/,
    "Must be a column range (e.g., A1:A10, 'Sheet'!A1:A10)",
  )
  .refine((val) => {
    // Extract the range part (after the optional sheet name)
    const rangeMatch = val.match(/(?:'[^']+'!)?([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!rangeMatch) return false;

    const [, startCol, startRow, endCol, endRow] = rangeMatch;
    const startRowInt = parseInt(startRow ?? '0');
    const endRowInt = parseInt(endRow ?? '0');

    // Check that start and end columns are the same
    if (startCol !== endCol) {
      return false;
    }

    // Check that range is max 10 rows
    const rowCount = endRowInt - startRowInt + 1;

    return rowCount <= 10;
  }, 'Range must be in the same column and contain max 10 rows');

const cellMappingSchema = z.object({
  name: columnRangeSchema.optional(),
  region: columnRangeSchema.optional(),
  producer: columnRangeSchema.optional(),
  vintage: columnRangeSchema.optional(),
  quantity: columnRangeSchema.optional(),
  unitCount: columnRangeSchema.optional(),
  unitSize: columnRangeSchema.optional(),
  source: columnRangeSchema.optional(),
  price: columnRangeSchema.optional(),
  currency: columnRangeSchema.optional(),
  exchangeRateUsd: columnRangeSchema.optional(),
  basePriceUsd: columnRangeSchema.optional(),
  priceUsd: columnRangeSchema.min(1, 'Price USD range is required'),

  // Single cells - optional except finalPriceUsd
  customerName: singleCellRefSchema.optional(),
  customerEmail: singleCellRefSchema.optional(),
  customerType: singleCellRefSchema.optional(),
  finalPriceUsd: singleCellRefSchema.min(1, 'Final Price USD cell is required'),
});

export type CellMappingSchema = z.infer<typeof cellMappingSchema>;

export default cellMappingSchema;
