import type { Workbook } from 'exceljs';
import ExcelJS from 'exceljs';

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
 *   const items = await parseLocalInventorySheet(buffer);
 *
 * @param buffer - XLSX file buffer from Google Sheets
 * @returns Array of parsed inventory items
 */
const parseLocalInventorySheet = async (buffer: ArrayBuffer) => {
  const workbook: Workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in the file');
  }

  const items: LocalInventoryItem[] = [];
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
    'LWIN18',
    'UAE IB Price EXW',
  ];

  for (const col of requiredColumns) {
    if (!columnIndexes[col]) {
      throw new Error(`Required column "${col}" not found in sheet`);
    }
  }

  // Parse each row (skip header)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const lwin18Raw = row.getCell(columnIndexes['LWIN18']!).value;
    if (!lwin18Raw) return; // Skip rows without LWIN18

    const lwin18 = convertLwin18(lwin18Raw);
    const productName = String(row.getCell(columnIndexes['Description:']!).value || '');
    const yearRaw = row.getCell(columnIndexes['Year']!).value;
    const yearNum = Number(yearRaw);
    const year = !isNaN(yearNum) ? yearNum : 0;
    const region = String(row.getCell(columnIndexes['Region']!).value || '');
    const country = String(row.getCell(columnIndexes['Country of Origin']!).value || '');
    const bottlesPerCaseRaw = row.getCell(columnIndexes['Bottles / Case']!).value;
    const bottlesPerCaseNum = Number(bottlesPerCaseRaw);
    const bottlesPerCase = !isNaN(bottlesPerCaseNum) ? bottlesPerCaseNum : 6;
    const bottleSizeRaw = row.getCell(columnIndexes['Bottle Size']!).value;
    const bottleSize = formatBottleSize(bottleSizeRaw);
    const priceRaw = row.getCell(columnIndexes['UAE IB Price EXW']!).value;
    const price = parsePrice(priceRaw);
    const availableQuantityRaw = row.getCell(columnIndexes['Quantity Cases']!).value;
    const availableQuantityNum = Number(availableQuantityRaw);
    const availableQuantity = !isNaN(availableQuantityNum) ? availableQuantityNum : 0;

    // Skip rows with invalid data
    if (!productName || !lwin18 || isNaN(price) || price <= 0 || availableQuantity <= 0) {
      return;
    }

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
    });
  });

  // Deduplicate by LWIN18 - keep the first occurrence of each
  const uniqueItems = Array.from(
    new Map(items.map((item) => [item.lwin18, item])).values()
  );

  return uniqueItems;
};

export default parseLocalInventorySheet;
