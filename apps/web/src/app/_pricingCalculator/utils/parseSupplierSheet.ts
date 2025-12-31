import type { Workbook } from 'exceljs';
import ExcelJS from 'exceljs';

interface ParsedSheetData {
  headers: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

/**
 * Parse an Excel file into raw data with detected headers
 *
 * Does not attempt to map columns - just extracts raw data for column mapping step
 *
 * @example
 *   const { headers, rows } = await parseSupplierSheet(buffer);
 *
 * @param buffer - File buffer (xlsx or xls)
 * @returns Parsed headers and rows
 */
const parseSupplierSheet = async (buffer: ArrayBuffer): Promise<ParsedSheetData> => {
  const workbook: Workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in the file');
  }

  // Extract headers from first row
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  const columnIndexMap: Record<number, string> = {};

  headerRow.eachCell((cell, colNumber) => {
    const header = String(cell.value || `Column ${colNumber}`).trim();
    headers.push(header);
    columnIndexMap[colNumber] = header;
  });

  if (headers.length === 0) {
    throw new Error('No headers found in the file');
  }

  // Parse each row into objects
  const rows: Record<string, unknown>[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const rowData: Record<string, unknown> = {};
    let hasData = false;

    row.eachCell((cell, colNumber) => {
      const header = columnIndexMap[colNumber];
      if (header) {
        const value = cell.value;
        // Handle different cell types
        if (value !== null && value !== undefined && value !== '') {
          rowData[header] = value;
          hasData = true;
        }
      }
    });

    // Only add rows that have some data
    if (hasData) {
      rows.push(rowData);
    }
  });

  return {
    headers,
    rows,
    rowCount: rows.length,
  };
};

export default parseSupplierSheet;
