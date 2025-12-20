import ExcelJS from 'exceljs';

/**
 * Parsed inventory item from local supplier sheet
 */
export interface LocalInventoryItem {
  lwin18: string;
  productName: string;
  year: number | null;
  bottlesPerCase: number;
  bottleSize: string;
  country: string | null;
  region: string | null;
  subRegion: string | null;
  price: number;
  currency: string;
  availableQuantity: number;
}

/**
 * Convert LWIN18 from scientific notation to full string
 *
 * @example
 *   convertLwin18(1.08e17); // returns '108000000000000000'
 *   convertLwin18('1.08E+17'); // returns '108000000000000000'
 *
 * @param value - LWIN18 value (may be number, string, or scientific notation)
 * @returns LWIN18 as 18-digit string
 */
const convertLwin18 = (value: unknown) => {
  if (typeof value === 'number') {
    // Convert scientific notation to string without exponent
    return value.toFixed(0);
  }

  const str = String(value);

  // Handle scientific notation in string format (e.g., "1.08E+17")
  if (str.includes('E') || str.includes('e')) {
    const num = parseFloat(str);
    return num.toFixed(0);
  }

  // Already a string, return as-is
  return str;
};

/**
 * Parse price from string format to number
 *
 * @example
 *   parsePrice('$438.73'); // returns 438.73
 *   parsePrice(438.73); // returns 438.73
 *
 * @param value - Price value (may include $ prefix)
 * @returns Price as number
 */
const parsePrice = (value: unknown) => {
  const str = String(value);

  // Remove $ and any whitespace
  const cleaned = str.replace(/[$\s]/g, '');

  return parseFloat(cleaned);
};

/**
 * Format bottle size with unit
 *
 * @example
 *   formatBottleSize('75'); // returns '75cl'
 *   formatBottleSize(75); // returns '75cl'
 *
 * @param value - Bottle size (typically in centiliters)
 * @returns Formatted bottle size with 'cl' unit
 */
const formatBottleSize = (value: unknown) => {
  const str = String(value);

  // If already has unit, return as-is
  if (str.toLowerCase().includes('cl') || str.toLowerCase().includes('ml')) {
    return str;
  }

  // Append 'cl' unit
  return `${str}cl`;
};

/**
 * Parse local inventory Google Sheet into structured data
 *
 * Expected columns (in order):
 * 1. Quantity Cases
 * 2. Quantity Bottles
 * 3. Description:
 * 4. Year
 * 5. Bottles / Case
 * 6. Bottle Size
 * 7. Country of Origin
 * 8. Region
 * 9. Sub-region
 * 10. Colour
 * 11. Commodity Code
 * 12. LWIN18
 * 13. UAE IB Price EXW
 * 14. Price in Case or Bottles
 * 15. Lead time from UAE warehouse
 *
 * @param buffer - ArrayBuffer from downloaded Google Sheet XLSX
 * @returns Array of parsed inventory items
 */
const parseLocalInventorySheet = async (buffer: ArrayBuffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // Get first worksheet
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in the spreadsheet');
  }

  const items: LocalInventoryItem[] = [];
  let isFirstRow = true;

  worksheet.eachRow((row) => {
    // Skip header row
    if (isFirstRow) {
      isFirstRow = false;
      return;
    }

    try {
      // Extract values from columns (1-indexed)
      const quantityCases = row.getCell(1).value;
      const description = row.getCell(3).value;
      const year = row.getCell(4).value;
      const bottlesPerCase = row.getCell(5).value;
      const bottleSize = row.getCell(6).value;
      const country = row.getCell(7).value;
      const region = row.getCell(8).value;
      const subRegion = row.getCell(9).value;
      const lwin18Raw = row.getCell(12).value;
      const priceRaw = row.getCell(13).value;

      // Skip rows with missing critical fields
      if (!lwin18Raw || !description || !priceRaw || !quantityCases) {
        return;
      }

      // Transform LWIN18 from scientific notation to full string
      const lwin18 = convertLwin18(lwin18Raw);

      // Transform price from "$XXX.XX" to number
      const price = parsePrice(priceRaw);

      // Transform bottle size from "75" to "75cl"
      const bottleSizeFormatted = formatBottleSize(bottleSize);

      // Parse quantity as integer
      const availableQuantity = parseInt(String(quantityCases), 10);

      // Parse bottles per case as integer
      const bottles = parseInt(String(bottlesPerCase), 10);

      // Validate required numeric fields
      if (
        isNaN(availableQuantity) ||
        isNaN(price) ||
        isNaN(bottles) ||
        !lwin18
      ) {
        console.warn('Skipping row with invalid data:', {
          lwin18Raw,
          priceRaw,
          quantityCases,
          bottlesPerCase,
        });
        return;
      }

      items.push({
        lwin18,
        productName: String(description),
        year: year ? parseInt(String(year), 10) : null,
        bottlesPerCase: bottles,
        bottleSize: bottleSizeFormatted,
        country: country ? String(country) : null,
        region: region ? String(region) : null,
        subRegion: subRegion ? String(subRegion) : null,
        price,
        currency: 'USD', // Fixed currency for local inventory
        availableQuantity,
      });
    } catch (error) {
      console.error('Error parsing row:', error);
      // Continue to next row
    }
  });

  return items;
};

export default parseLocalInventorySheet;
