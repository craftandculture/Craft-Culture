import { eq, sql } from 'drizzle-orm';
import type { Workbook } from 'exceljs';
import ExcelJS from 'exceljs';

import db from '@/database/client';
import { lwinWines } from '@/database/schema';
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
 * Lookup LWIN wine by LWIN code (direct match)
 */
const lookupLwinDirect = async (lwin18: string) => {
  // Extract LWIN11 (first 11 digits) from LWIN18 for matching
  const lwin11 = lwin18.slice(0, 11);

  const results = await db
    .select({
      lwin: lwinWines.lwin,
      displayName: lwinWines.displayName,
      producerName: lwinWines.producerName,
      country: lwinWines.country,
      region: lwinWines.region,
    })
    .from(lwinWines)
    .where(eq(lwinWines.lwin, lwin11))
    .limit(1);

  return results[0] || null;
};

/**
 * Fuzzy match LWIN wine by product name using trigram similarity
 */
const lookupLwinFuzzy = async (productName: string) => {
  try {
    // Remove vintage from product name for better matching
    const nameWithoutVintage = productName
      .replace(/\b(19|20)\d{2}\b/g, '')
      .trim();

    const results = await db
      .select({
        lwin: lwinWines.lwin,
        displayName: lwinWines.displayName,
        producerName: lwinWines.producerName,
        country: lwinWines.country,
        region: lwinWines.region,
        similarity: sql<number>`similarity(${lwinWines.displayName}, ${nameWithoutVintage})`,
      })
      .from(lwinWines)
      .where(sql`similarity(${lwinWines.displayName}, ${nameWithoutVintage}) > 0.3`)
      .orderBy(sql`similarity(${lwinWines.displayName}, ${nameWithoutVintage}) DESC`)
      .limit(1);

    if (results.length > 0 && results[0]) {
      return {
        ...results[0],
        similarity: results[0].similarity,
      };
    }

    return null;
  } catch {
    // If trigram extension not available, fall back to ILIKE
    const searchPattern = `%${productName.replace(/\s+/g, '%')}%`;

    const results = await db
      .select({
        lwin: lwinWines.lwin,
        displayName: lwinWines.displayName,
        producerName: lwinWines.producerName,
        country: lwinWines.country,
        region: lwinWines.region,
      })
      .from(lwinWines)
      .where(sql`${lwinWines.displayName} ILIKE ${searchPattern}`)
      .limit(1);

    if (results.length > 0 && results[0]) {
      return {
        ...results[0],
        similarity: 0.5,
      };
    }

    return null;
  }
};

/**
 * Parse local inventory Google Sheet into structured data with LWIN matching
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
 *   console.log(result.stats); // { matched: 280, unmatched: 20, total: 300 }
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

  // LWIN18 is optional - we can fuzzy match if missing
  for (const col of requiredColumns) {
    if (!columnIndexes[col]) {
      throw new Error(`Required column "${col}" not found in sheet`);
    }
  }

  // Collect all rows first (eachRow is synchronous, but we need async for LWIN lookup)
  const rows: Array<{
    rowNumber: number;
    lwin18Raw: unknown;
    productName: string;
    year: number;
    region: string;
    country: string;
    bottlesPerCase: number;
    bottleSize: string;
    price: number;
    availableQuantity: number;
  }> = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const lwin18Raw = columnIndexes['LWIN18']
      ? row.getCell(columnIndexes['LWIN18']!).value
      : null;
    const productName = String(
      row.getCell(columnIndexes['Description:']!).value || '',
    );
    const yearRaw = row.getCell(columnIndexes['Year']!).value;
    const yearNum = Number(yearRaw);
    const year = !isNaN(yearNum) ? yearNum : 0;
    const region = String(
      row.getCell(columnIndexes['Region']!).value || '',
    );
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

    rows.push({
      rowNumber,
      lwin18Raw,
      productName,
      year,
      region,
      country,
      bottlesPerCase,
      bottleSize,
      price,
      availableQuantity,
    });
  });

  stats.total = rows.length;

  // Process each row with LWIN lookup
  for (const row of rows) {
    const {
      rowNumber,
      lwin18Raw,
      productName,
      year,
      region,
      country,
      bottlesPerCase,
      bottleSize,
      price,
      availableQuantity,
    } = row;

    // Skip rows with invalid price or quantity (required for inventory)
    if (isNaN(price) || price <= 0) {
      skipped.push({
        rowNumber,
        reason: 'Invalid or missing price',
        rawData: { productName, price, quantity: availableQuantity },
      });
      stats.skipped++;
      continue;
    }

    if (availableQuantity <= 0) {
      skipped.push({
        rowNumber,
        reason: 'Zero or negative quantity',
        rawData: { productName, price, quantity: availableQuantity },
      });
      stats.skipped++;
      continue;
    }

    if (!productName) {
      skipped.push({
        rowNumber,
        reason: 'Missing product name',
        rawData: { price, quantity: availableQuantity },
      });
      stats.skipped++;
      continue;
    }

    let lwin18 = lwin18Raw ? convertLwin18(lwin18Raw) : '';
    let matchSource: 'lwin_direct' | 'lwin_fuzzy' | 'sheet_only' = 'sheet_only';
    let matchConfidence = 0;
    let finalProductName = productName;
    let finalRegion = region;
    let finalCountry = country;

    // Try direct LWIN lookup if LWIN18 is present
    if (lwin18) {
      const directMatch = await lookupLwinDirect(lwin18);
      if (directMatch) {
        matchSource = 'lwin_direct';
        matchConfidence = 1.0;
        finalProductName = directMatch.displayName || productName;
        finalRegion = directMatch.region || region;
        finalCountry = directMatch.country || country;
        stats.lwinDirect++;
        stats.matched++;
        logger.dev(
          `LWIN direct match: Row ${rowNumber} - ${productName} → ${directMatch.displayName}`,
        );
      } else {
        // LWIN18 provided but not found in database - try fuzzy match
        logger.dev(
          `LWIN18 not found in database: ${lwin18} for "${productName}"`,
        );
      }
    }

    // If no direct match, try fuzzy matching by product name
    if (matchSource === 'sheet_only') {
      const fuzzyMatch = await lookupLwinFuzzy(productName);
      if (fuzzyMatch && fuzzyMatch.similarity >= 0.4) {
        matchSource = 'lwin_fuzzy';
        matchConfidence = fuzzyMatch.similarity;
        lwin18 = fuzzyMatch.lwin;
        finalProductName = fuzzyMatch.displayName || productName;
        finalRegion = fuzzyMatch.region || region;
        finalCountry = fuzzyMatch.country || country;
        stats.lwinFuzzy++;
        stats.matched++;
        logger.dev(
          `LWIN fuzzy match: Row ${rowNumber} - "${productName}" → ${fuzzyMatch.displayName} (${(fuzzyMatch.similarity * 100).toFixed(0)}%)`,
        );
      } else {
        // No match found - still include item but flag as unmatched
        stats.unmatched++;
        logger.dev(
          `No LWIN match for row ${rowNumber}: "${productName}"`,
        );
      }
    }

    // Always include the item (don't skip silently)
    items.push({
      lwin18: lwin18 || `unmatched:row${rowNumber}`,
      productName: finalProductName,
      year,
      region: finalRegion,
      country: finalCountry,
      bottlesPerCase,
      bottleSize,
      price,
      currency: 'USD',
      availableQuantity,
      rowNumber,
      matchSource,
      matchConfidence,
    });
  }

  logger.info('Local inventory parsing complete', {
    total: stats.total,
    matched: stats.matched,
    unmatched: stats.unmatched,
    skipped: stats.skipped,
    lwinDirect: stats.lwinDirect,
    lwinFuzzy: stats.lwinFuzzy,
  });

  return { items, skipped, stats };
};

export default parseLocalInventorySheet;
