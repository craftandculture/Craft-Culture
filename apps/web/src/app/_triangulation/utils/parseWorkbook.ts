import * as XLSX from 'xlsx';

export interface ParsedSheet {
  name: string;
  /** Raw cell matrix, header row included — the wizard picks which row that is */
  matrix: unknown[][];
}

/**
 * Read an uploaded Excel or CSV file into raw cell matrices, one per sheet
 *
 * Parsing happens in the browser so a 20,000-row City Drinks export never has
 * to be posted as a file; only the mapped rows travel to the server.
 *
 * The header row is deliberately left in place: monthly exports routinely
 * carry title and filter rows above the real headers, so the wizard lets the
 * user point at the right one rather than guessing silently.
 *
 * @param file - The uploaded .xlsx, .xls or .csv file
 * @returns One entry per sheet, each holding its full cell matrix
 */
const parseWorkbook = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheets: ParsedSheet[] = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];

    if (!sheet) {
      return { name, matrix: [] };
    }

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
      raw: true,
    });

    return { name, matrix };
  });

  return sheets.filter((sheet) => sheet.matrix.length > 0);
};

export default parseWorkbook;
