import type { Workbook } from 'exceljs';
import ExcelJS from 'exceljs';

import logger from '@/utils/logger';

interface LocalInventoryItem {
  lwin18: string;
  productName: string;
  year: number;
  region: string;
  country: string;
  bottlesPerCase: number;
  bottleSize: string;
  price: number;
  currency: string;
  availableQuantity: number;
  rowNumber: number;
  matchSource: 'lwin_direct' | 'lwin_fuzzy' | 'sheet_only';
  matchConfidence: number;
}

interface SkippedRow {
  rowNumber: number;
  reason: string;
  rawData: {
    lwin18?: string;
    productName?: string;
    price?: number;
    quantity?: number;
  };
}

export interface ParseResult {
  items: LocalInventoryItem[];
  skipped: SkippedRow[];
  stats: {
    total: number;
    matched: number;
    unmatched: number;
    skipped: number;
    lwinDirect: number;
    lwinFuzzy: number;
  };
}

/**
 * Convert LWIN18 from scientific notation to full string
 *
 * @example
 *   convertLwin18(1.08E+17); // "108000000000000000"
 *
 * @param value - LWIN18 value (may be number in scientific notation)
 * @returns Full LWIN18 string
 */
const convertLwin18 = (value: unknown) => {
  if (typeof value === 'number') {
    return value.toFixed(0);
  }
  const str = String(value);
  if (str.includes('E') || str.includes('e')) {
    const num = parseFloat(str);
    return num.toFixed(0);
  }
  return str;
};

/**
 * Parse price string and extract numeric value
 *
 * @example
 *   parsePrice('$438.73'); // 438.73
 *
 * @param value - Price value (may include currency symbols)
 * @returns Numeric price
 */
const parsePrice = (value: unknown) => {
  const str = String(value);
  const cleaned = str.replace(/[$\s]/g, '');
  return parseFloat(cleaned);
};

/**
 * Format bottle size with unit
 *
 * @example
 *   formatBottleSize('75'); // "75cl"
 *
 * @param value - Bottle size value
 * @returns Formatted bottle size with unit
 */
const formatBottleSize = (value: unknown) => {
  const str = String(value);
  if (str.toLowerCase().includes('cl') || str.toLowerCase().includes('ml')) {
    return str;
  }
  return `${str}cl`;
};

/**
 * Parse local inventory Google Sheet into structured data
 *
 * Expected columns:
 * - Quantity Cases → Available quantity
 * - Description: → Product name
 * - Year → Vintage
 * - Bottles / Case → Unit count
 * - Bottle Size → Bottle size in cl
 * - Country of Origin → Country
 * - Region → Wine region
 * - LWIN18 → Wine identifier (in scientific notation)
 * - UAE IB Price EXW → Price in USD
 *
 * @example
 *   const result = await parseLocalInventorySheet(buffer);
 *   console.log(result.stats); // { matched: 0, unmatched: 300, total: 300 }
 *
 * @param buffer - XLSX file buffer from Google Sheets
 * @returns ParseResult with items, skipped rows, and match statistics
 */
const parseLocalInventorySheet = async (
  buffer: ArrayBuffer,
): Promise<ParseResult> => {
  const workbook: Workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in the file');
  }

  const items: LocalInventoryItem[] = [];
  const skipped: SkippedRow[] = [];
  const stats = {
    total: 0,
    matched: 0,
    unmatched: 0,
    skipped: 0,
    lwinDirect: 0,
    lwinFuzzy: 0,
  };

  const headerRow = worksheet.getRow(1);

  // Find column indexes by header name
  const columnIndexes: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const header = String(cell.value).trim();
    columnIndexes[header] = colNumber;
  });

  // Validate required columns exist
  const requiredColumns = [
    'Quantity Cases',
    'Description:',
    'Year',
    'Bottles / Case',
    'Bottle Size',
    'Country of Origin',
    'Region',
    'UAE IB Price EXW',
  ];

  // LWIN18 is optional
  for (const col of requiredColumns) {
    if (!columnIndexes[col]) {
      throw new Error(`Required column "${col}" not found in sheet`);
    }
  }

  // Process rows synchronously (no async DB lookups)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    stats.total++;

    const lwin18Raw = columnIndexes['LWIN18']
      ? row.getCell(columnIndexes['LWIN18']!).value
      : null;
    const productName = String(
      row.getCell(columnIndexes['Description:']!).value || '',
    );
    const yearRaw = row.getCell(columnIndexes['Year']!).value;
    const yearNum = Number(yearRaw);
    const year = !isNaN(yearNum) ? yearNum : 0;
    const region = String(row.getCell(columnIndexes['Region']!).value || '');
    const country = String(
      row.getCell(columnIndexes['Country of Origin']!).value || '',
    );
    const bottlesPerCaseRaw =
      row.getCell(columnIndexes['Bottles / Case']!).value;
    const bottlesPerCaseNum = Number(bottlesPerCaseRaw);
    const bottlesPerCase = !isNaN(bottlesPerCaseNum) ? bottlesPerCaseNum : 6;
    const bottleSizeRaw = row.getCell(columnIndexes['Bottle Size']!).value;
    const bottleSize = formatBottleSize(bottleSizeRaw);
    const priceRaw = row.getCell(columnIndexes['UAE IB Price EXW']!).value;
    const price = parsePrice(priceRaw);
    const availableQuantityRaw =
      row.getCell(columnIndexes['Quantity Cases']!).value;
    const availableQuantityNum = Number(availableQuantityRaw);
    const availableQuantity = !isNaN(availableQuantityNum)
      ? availableQuantityNum
      : 0;

    // Skip rows with invalid price (required for inventory)
    if (isNaN(price) || price <= 0) {
      skipped.push({
        rowNumber,
        reason: 'Invalid or missing price',
        rawData: { productName, price, quantity: availableQuantity },
      });
      stats.skipped++;
      return;
    }

    // Skip if quantity is explicitly negative (allow 0 for out-of-stock items)
    if (availableQuantity < 0) {
      skipped.push({
        rowNumber,
        reason: 'Negative quantity',
        rawData: { productName, price, quantity: availableQuantity },
      });
      stats.skipped++;
      return;
    }

    if (!productName) {
      skipped.push({
        rowNumber,
        reason: 'Missing product name',
        rawData: { price, quantity: availableQuantity },
      });
      stats.skipped++;
      return;
    }

    // Use LWIN18 from sheet if available, otherwise use row number as identifier
    const lwin18 = lwin18Raw ? convertLwin18(lwin18Raw) : `sheet:row${rowNumber}`;

    // Track as unmatched (no DB lookup for now - can add batch matching later)
    stats.unmatched++;

    items.push({
      lwin18,
      productName,
      year,
      region,
      country,
      bottlesPerCase,
      bottleSize,
      price,
      currency: 'USD',
      availableQuantity,
      rowNumber,
      matchSource: 'sheet_only',
      matchConfidence: 0,
    });
  });

  logger.info('Local inventory parsing complete', {
    total: stats.total,
    matched: stats.matched,
    unmatched: stats.unmatched,
    skipped: stats.skipped,
  });

  return { items, skipped, stats };
};

export default parseLocalInventorySheet;
