import * as XLSX from 'xlsx';

export interface InvoiceSheet {
  /** Header labels exactly as the supplier wrote them */
  headers: string[];
  /** One record per data row, keyed by header */
  rows: Record<string, unknown>[];
  sheetName: string;
}

/**
 * How far down to hunt for the header row.
 *
 * Suppliers put a logo, an address block and a subject line above the table.
 * The header is the first row that looks like column labels rather than
 * letterhead, and it is never far down.
 */
const MAX_HEADER_SEARCH = 25;

/** A header row is several non-empty, short, distinct labels */
const looksLikeHeader = (row: unknown[]) => {
  const labels = row
    .map((cell) => String(cell ?? '').trim())
    .filter((cell) => cell.length > 0);

  if (labels.length < 3) return false;

  const distinct = new Set(labels.map((label) => label.toLowerCase()));

  return (
    distinct.size === labels.length &&
    labels.every((label) => label.length <= 60)
  );
};

/**
 * Read a supplier's spreadsheet into headers and rows
 *
 * A spreadsheet of the same invoice is a better source than the PDF of it: the
 * numbers are exact rather than read off a page, and the rows can be parsed in
 * code. That matters at scale — asking a model to reproduce 163 line items as
 * JSON is what truncated the PDF extraction, and no row count can truncate a
 * loop.
 *
 * The header row is found rather than assumed, because the table rarely starts
 * at A1 — there is usually letterhead above it.
 *
 * @param base64 - The uploaded workbook
 * @returns The header labels and every row beneath them
 */
const readInvoiceSheet = (base64: string): InvoiceSheet => {
  // The browser hands over a data URL; the decoder wants only the payload.
  const payload = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;

  const workbook = XLSX.read(Buffer.from(payload, 'base64'), { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('That workbook has no sheets');
  }

  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`Could not read the sheet "${sheetName}"`);
  }

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
  });

  const headerIndex = grid
    .slice(0, MAX_HEADER_SEARCH)
    .findIndex((row) => looksLikeHeader(row));

  if (headerIndex === -1) {
    throw new Error(
      'No column headings found in the first rows of that sheet — is the table further down, or on another tab?',
    );
  }

  const headerRow = grid[headerIndex] ?? [];
  const headers = headerRow.map((cell, index) => {
    const label = String(cell ?? '').trim();

    // An unlabelled column still has to be addressable by the mapper.
    return label.length > 0 ? label : `column_${index + 1}`;
  });

  const rows = grid
    .slice(headerIndex + 1)
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index]])),
    )
    // Totals and blank spacers sit below the table; a row with almost nothing
    // in it is not a line item.
    .filter(
      (row) =>
        Object.values(row).filter(
          (value) => value !== null && String(value).trim() !== '',
        ).length >= 2,
    );

  return { headers, rows, sheetName };
};

export default readInvoiceSheet;
