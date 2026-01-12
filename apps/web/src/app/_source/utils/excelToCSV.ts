import type { Workbook } from 'exceljs';
import ExcelJS from 'exceljs';

/**
 * Escape a value for CSV format
 */
const escapeCSV = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // If the value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
};

/**
 * Convert an Excel file buffer to CSV string using exceljs
 *
 * This utility provides a secure server-side alternative to client-side xlsx parsing.
 * It uses exceljs which doesn't have the prototype pollution vulnerability present in xlsx.
 *
 * @example
 *   const buffer = Buffer.from(base64Data, 'base64');
 *   const csv = await excelToCSV(buffer);
 *
 * @param buffer - Excel file buffer (xlsx, xls)
 * @returns CSV string representation of the first worksheet
 */
const excelToCSV = async (buffer: ArrayBuffer | Buffer): Promise<string> => {
  const workbook: Workbook = new ExcelJS.Workbook();

  // Ensure we have a proper Buffer for exceljs
  const nodeBuffer = Buffer.isBuffer(buffer)
    ? (buffer as Buffer)
    : Buffer.from(buffer);

  // Try XLSX format first, fall back to CSV if it fails
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(nodeBuffer as any);
  } catch {
    // If XLSX fails, try parsing the buffer as CSV text
    try {
      const csvText = nodeBuffer.toString('utf-8');
      // Parse CSV manually by creating a simple worksheet
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

  const rows: string[] = [];

  worksheet.eachRow((row) => {
    const cells: string[] = [];

    row.eachCell({ includeEmpty: true }, (cell) => {
      // Get the actual value, handling formulas
      const value = cell.value;

      // Handle different cell value types
      if (value === null || value === undefined) {
        cells.push('');
      } else if (typeof value === 'object' && 'result' in value) {
        // Formula cell - use the result
        cells.push(escapeCSV(value.result));
      } else if (typeof value === 'object' && 'text' in value) {
        // Rich text cell
        cells.push(escapeCSV(value.text));
      } else if (value instanceof Date) {
        cells.push(escapeCSV(value.toISOString()));
      } else {
        cells.push(escapeCSV(value));
      }
    });

    rows.push(cells.join(','));
  });

  return rows.join('\n');
};

export default excelToCSV;
