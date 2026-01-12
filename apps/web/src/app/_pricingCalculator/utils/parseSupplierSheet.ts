import type { Workbook } from 'exceljs';
import ExcelJS from 'exceljs';

interface ParsedSheetData {
  headers: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

/**
 * Get cell value handling various exceljs cell types
 */
const getCellValue = (cell: ExcelJS.Cell): unknown => {
  const value = cell.value;

  if (value === null || value === undefined) {
    return '';
  }

  // Handle formula cells
  if (typeof value === 'object' && 'result' in value) {
    return value.result ?? '';
  }

  // Handle rich text cells
  if (typeof value === 'object' && 'richText' in value) {
    return (value.richText as { text: string }[]).map((r) => r.text).join('');
  }

  // Handle date cells
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

/**
 * Parse an Excel file into raw data with detected headers
 *
 * Uses exceljs library for secure server-side Excel parsing
 *
 * @example
 *   const { headers, rows } = await parseSupplierSheet(buffer);
 *
 * @param buffer - File buffer (xlsx, xls, or csv)
 * @returns Parsed headers and rows
 */
const parseSupplierSheet = async (buffer: ArrayBuffer): Promise<ParsedSheetData> => {
  const workbook: Workbook = new ExcelJS.Workbook();

  // Ensure we have a proper Buffer for exceljs
  const nodeBuffer = Buffer.isBuffer(buffer)
    ? (buffer as Buffer)
    : Buffer.from(buffer);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(nodeBuffer as any);
  } catch {
    // If XLSX fails, try parsing the buffer as CSV text
    try {
      const csvText = nodeBuffer.toString('utf-8');
      const lines = csvText.split('\n');
      const ws = workbook.addWorksheet('Sheet1');
      lines.forEach((line, rowIndex) => {
        const cells = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
        cells.forEach((cell, colIndex) => {
          ws.getCell(rowIndex + 1, colIndex + 1).value = cell;
        });
      });
    } catch {
      throw new Error('Unable to parse file. Please ensure it is a valid Excel or CSV file.');
    }
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in the file');
  }

  // Convert worksheet to array of arrays
  const rawData: unknown[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const rowData: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      rowData.push(getCellValue(cell));
    });
    rawData.push(rowData);
  });

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
