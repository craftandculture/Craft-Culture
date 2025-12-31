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
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });

  if (rawData.length === 0) {
    throw new Error('No data found in the file');
  }

  // Extract headers from first row
  const headerRow = rawData[0] as unknown[];
  const headers: string[] = headerRow.map((cell, index) =>
    cell !== null && cell !== undefined && cell !== ''
      ? String(cell).trim()
      : `Column ${index + 1}`,
  );

  if (headers.length === 0) {
    throw new Error('No headers found in the file');
  }

  // Parse remaining rows into objects
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i] as unknown[];
    if (!row || row.length === 0) continue;

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
