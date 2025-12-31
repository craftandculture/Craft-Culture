import * as XLSX from 'xlsx';

interface ParsedSheetData {
  headers: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

/**
 * Parse an Excel file into raw data with detected headers
 *
 * Uses xlsx (SheetJS) library which works in browser environments
 *
 * @example
 *   const { headers, rows } = await parseSupplierSheet(buffer);
 *
 * @param buffer - File buffer (xlsx, xls, or csv)
 * @returns Parsed headers and rows
 */
const parseSupplierSheet = async (buffer: ArrayBuffer): Promise<ParsedSheetData> => {
  const data = new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: 'array' });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('No worksheet found in the file');
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error('No worksheet found in the file');
  }

  // Convert to array of arrays (first row is headers)
  // Use defval to ensure dense arrays (xlsx can return sparse arrays for empty cells)
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });

  if (rawData.length === 0) {
    throw new Error('No data found in the file');
  }

  // Find the header row - skip title/empty rows at the top
  // Look for the first row with at least 3 non-empty cells (likely the actual headers)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawData.length, 20); i++) {
    const row = Array.from(rawData[i] as unknown[]);
    const nonEmptyCells = row.filter(
      (cell) => cell !== null && cell !== undefined && cell !== '',
    ).length;
    // Header row typically has multiple columns filled
    if (nonEmptyCells >= 3) {
      headerRowIndex = i;
      break;
    }
  }

  // Extract headers from detected header row
  // Use Array.from to ensure dense array (handles any sparse arrays from xlsx)
  const headerRow = Array.from(rawData[headerRowIndex] as unknown[]);
  const headers: string[] = headerRow.map((cell, index) =>
    cell !== null && cell !== undefined && cell !== ''
      ? String(cell).trim()
      : `Column ${index + 1}`,
  );

  if (headers.length === 0) {
    throw new Error('No headers found in the file');
  }

  // Parse remaining rows into objects (starting after header row)
  const rows: Record<string, unknown>[] = [];

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const rawRow = rawData[i] as unknown[];
    if (!rawRow || rawRow.length === 0) continue;
    // Convert sparse array to dense array
    const row = Array.from(rawRow);

    const rowData: Record<string, unknown> = {};
    let hasData = false;

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = row[j];

      if (header && value !== null && value !== undefined && value !== '') {
        rowData[header] = value;
        hasData = true;
      }
    }

    // Only add rows that have some data
    if (hasData) {
      rows.push(rowData);
    }
  }

  return {
    headers,
    rows,
    rowCount: rows.length,
  };
};

export default parseSupplierSheet;
