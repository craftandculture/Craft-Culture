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
 * How much a row looks like the table's headings rather than letterhead.
 *
 * Taking the first row that passes is what broke this: "Reference: | CRA064 /
 * SI18342 | Tel: +44 …" is three short distinct labels six rows above the
 * table, so every column was keyed to a phone number and the workbook read as
 * nothing at all.
 *
 * A real heading row is wide and made of words. An address block is narrow and
 * carries values — a date, a reference, a number — so counting labelled columns
 * and penalising numeric cells separates the two without needing to know any
 * supplier's layout.
 */
const headerScore = (row: unknown[]) => {
  const cells = row.filter((cell) => cell !== null && String(cell).trim() !== '');
  const numeric = cells.filter((cell) => typeof cell === 'number').length;
  const wordy = cells.filter(
    (cell) => typeof cell === 'string' && cell.trim().length <= 30,
  ).length;

  return wordy - numeric * 2;
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

  // The best candidate, not the first: letterhead sits above the table and
  // often passes the same test.
  const headerIndex = grid
    .slice(0, MAX_HEADER_SEARCH)
    .reduce<number>((best, row, index) => {
      if (!looksLikeHeader(row)) return best;
      if (best === -1) return index;

      return headerScore(row) > headerScore(grid[best] ?? []) ? index : best;
    }, -1);

  if (headerIndex === -1) {
    throw new Error(
      'No column headings found in the first rows of that sheet — is the table further down, or on another tab?',
    );
  }

  const headerRow = grid[headerIndex] ?? [];

  /**
   * Whether the row below the headings is a second header rather than data.
   *
   * A shipping invoice heads one column "Quantity" and splits it into "cs" and
   * "bt" beneath, so the sub-labels sit a row lower than everything else. Taking
   * a single header row leaves the bottle column with no name at all, every row
   * then reads blank, and the workbook imports as nothing — which is what
   * "0 lines from Worksheet" was.
   *
   * A sub-header is all short text and no numbers; a data row has the
   * quantities and prices in it.
   */
  const subRow = grid[headerIndex + 1] ?? [];
  const subCells = subRow.filter(
    (cell) => cell !== null && String(cell).trim() !== '',
  );

  const isSubHeader =
    subCells.length >= 2 &&
    subCells.length < headerRow.filter((cell) => cell !== null).length &&
    subCells.every(
      (cell) => typeof cell !== 'number' && String(cell).trim().length <= 12,
    );

  const headers = headerRow.map((cell, index) => {
    const label = String(cell ?? '').trim();
    const sub = isSubHeader ? String(subRow[index] ?? '').trim() : '';

    // "Quantity" + "cs" reads as one heading the mapper can tell from its
    // neighbour, where two columns both called "Quantity" could not be. A
    // sub-label repeating its own heading — "Litres" under "Litres" — is the
    // sheet carrying the label down, not a second level.
    const combined =
      sub && sub.toLowerCase() !== label.toLowerCase()
        ? [label, sub].filter(Boolean).join(' ')
        : label || sub;

    // An unlabelled column still has to be addressable by the mapper.
    return combined.length > 0 ? combined : `column_${index + 1}`;
  });

  const firstDataIndex = headerIndex + (isSubHeader ? 2 : 1);

  const rows = grid
    .slice(firstDataIndex)
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
