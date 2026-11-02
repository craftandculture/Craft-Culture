import * as XLSX from 'xlsx';

export interface OutletCodeRow {
  /** City Drinks' code, squashed (CDR8413460587); null where none was given */
  outletCode: string | null;
  wineName: string;
  /** The owner as the sheet writes it: C&C, CRU, RARE, Crurated, CULT… */
  ownerLabel: string | null;
  /** INV-000176 */
  docRef: string | null;
  /** YYYY-MM-DD */
  docDate: string | null;
  caseConfig: string | null;
  isConsignment: boolean | null;
}

export interface ParsedOutletCodes {
  rows: OutletCodeRow[];
  sheetName: string;
  skipped: number;
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

const squash = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

const text = (value: unknown) => {
  if (value === null || value === undefined) return '';

  return String(value).trim();
};

/**
 * "06 Apr 2026" or a spreadsheet date serial, as YYYY-MM-DD
 *
 * @param value - The cell
 * @returns The date, or null when it is not one
 */
const readDate = (value: unknown) => {
  if (typeof value === 'number' && value > 20000) {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }

  const found = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/.exec(text(value));
  const month = found ? MONTHS[found[2]!.toLowerCase()] : undefined;

  if (!found || !month) return null;

  return `${found[3]}-${month}-${found[1]!.padStart(2, '0')}`;
};

/**
 * "INV-236", "inv 000236" and "INV-000236" are one invoice
 *
 * @param value - The cell
 * @returns The invoice number in Zoho's form, or null
 */
const readInvoice = (value: unknown) => {
  const found = /INV[\s-]*0*(\d+)/i.exec(text(value));

  if (!found) return null;

  return `INV-${found[1]!.padStart(6, '0')}`;
};

/**
 * Read the Codes tab of the "CD x C&C Payment Run" sheet
 *
 * It is the outlet's register of its own codes: each CDR code against the
 * wine, the owner and the invoice it came in on. The columns are found by
 * their headings rather than their position, because the sheet is kept by
 * hand and a column inserted to the left would otherwise shift every reading
 * by one without a word.
 *
 * Rows without a CDR code are kept. Many C&C lines on INV-000312 have none,
 * and the owner against the invoice is still worth knowing.
 *
 * @example
 *   parseOutletCodesSheet(base64).rows[0];
 *   // { outletCode: 'CDR2988132037', ownerLabel: 'C&C', docRef: 'INV-000236', … }
 *
 * @param file - The workbook (xlsx or csv), base64
 * @returns The rows, the sheet read, and how many were skipped
 */
const parseOutletCodesSheet = (file: string) => {
  const workbook = XLSX.read(file, { type: 'base64' });
  const sheetName =
    workbook.SheetNames.find((name) => /^codes$/i.test(name.trim())) ??
    workbook.SheetNames[0];

  if (!sheetName) throw new Error('That file has no sheets.');

  const grid = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName]!, {
    header: 1,
    blankrows: false,
    raw: true,
  });

  const headerIndex = grid.findIndex((row) =>
    row.some((cell) => /^(cd|cdr)\s*code$/i.test(text(cell))),
  );

  if (headerIndex < 0) {
    throw new Error(
      'No "CD Code" column found. Upload the Codes tab of the CD x C&C Payment Run sheet.',
    );
  }

  const headings = grid[headerIndex]!.map((cell) => text(cell).toLowerCase());
  const column = (test: RegExp) => headings.findIndex((cell) => test.test(cell));

  const at = {
    wine: column(/^wine$/),
    owner: column(/^owner$/),
    invoice: column(/^invoice\s*(number|no)/),
    date: column(/^invoice\s*date/),
    code: column(/^(cd|cdr)\s*code$/),
    pack: column(/^case\s*config/),
    consignment: column(/^consignment/),
  };

  if (at.wine < 0 || at.owner < 0) {
    throw new Error('The Codes tab needs its "Wine" and "Owner" columns.');
  }

  const rows: OutletCodeRow[] = [];
  let skipped = 0;

  for (const row of grid.slice(headerIndex + 1)) {
    const wineName = text(row[at.wine]);

    if (!wineName) {
      skipped += 1;
      continue;
    }

    const code = at.code >= 0 ? squash(text(row[at.code])) : '';
    const consignment = at.consignment >= 0 ? text(row[at.consignment]) : '';

    rows.push({
      outletCode: /^CDR\d+$/.test(code) ? code : null,
      wineName,
      ownerLabel: text(row[at.owner]) || null,
      docRef: at.invoice >= 0 ? readInvoice(row[at.invoice]) : null,
      docDate: at.date >= 0 ? readDate(row[at.date]) : null,
      caseConfig: at.pack >= 0 ? text(row[at.pack]) || null : null,
      isConsignment: /^y/i.test(consignment)
        ? true
        : /^n/i.test(consignment)
          ? false
          : null,
    });
  }

  return { rows, sheetName, skipped } satisfies ParsedOutletCodes;
};

export default parseOutletCodesSheet;
