import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';

/** One line of LCB's Rotation Stock report, as the spreadsheet gives it */
export type LcbStockRow = Record<string, string | number | null | undefined>;

/** The columns an import cannot do without */
export const LCB_REQUIRED_COLUMNS = ['Rotation', 'Code', 'Cases', 'Singles'] as const;

/*
  Vision exports more than one stock report. "Rotation Stock" heads its
  columns Rotation, Code, Cases; "Rotation Stock by Supplier" heads them
  ROTATION, PRODUCT, CASES and adds the supplier. Headers are compared with
  case and punctuation removed, and these are the other names a column goes
  by, so either report reads (19 October 2026: the by-supplier report was
  refused for having no "Code" column).
*/
const COLUMN_ALIASES: Record<string, string[]> = {
  code: ['product', 'productcode', 'lwin'],
  received: ['receiveddate', 'datereceived'],
  rotationnotes: ['notes'],
};

/**
 * Columns that may carry the reference the wine was sent in under
 *
 * The standard report has none of these. If LCB add the order reference or
 * reserve to it, the member reference quoted on the paperwork comes through
 * and the rotation can be placed without anyone matching it by hand.
 */
export const LCB_REFERENCE_COLUMNS = [
  'Your Ref',
  'PO Ref',
  'Customer Ref',
  'Cust Ref',
  'Order Ref',
  'Reference',
  'Reserve',
  'Reserve Code',
] as const;

const headerKey = (header: string) => header.toLowerCase().replace(/[^a-z]/g, '');

const REFERENCE_KEYS = new Set(LCB_REFERENCE_COLUMNS.map(headerKey));

/** Whether a set of headers has a column, under its own name or another */
export const hasLcbColumn = (headers: Iterable<string>, column: string) => {
  const keys = new Set([...headers].map(headerKey));
  const wanted = headerKey(column);
  return keys.has(wanted) || (COLUMN_ALIASES[wanted] ?? []).some((alias) => keys.has(alias));
};

/** A column's value by name, whatever case or alias the report used */
const field = (row: LcbStockRow, column: string) => {
  const wanted = headerKey(column);
  const names = [wanted, ...(COLUMN_ALIASES[wanted] ?? [])];
  for (const [header, value] of Object.entries(row)) {
    if (names.includes(headerKey(header))) return value;
  }
  return undefined;
};

const text = (value: unknown) => {
  const trimmed = String(value ?? '').replace(/\s+/g, ' ').trim();
  return trimmed || null;
};

const whole = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? '').replace(/,/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * "30/09/2026 00:00:00", as Vision writes it, read as a UK date. The
 * by-supplier report gives the spreadsheet's own day number (46314 is
 * 19 October 2026), which is read from Excel's epoch.
 */
const ukDate = (value: unknown) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value ?? '').trim();
  if (/^\d{5}(\.\d+)?$/.test(raw)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(raw)) * 86_400_000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(raw);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Read one line of LCB's Rotation Stock report
 *
 * Columns are found by their header, not their position, so a report with a
 * column added or moved still reads. Quantities come as whole cases plus
 * singles; TSingles, LCB's own total in bottles, is preferred when present and
 * otherwise worked out from SPC (bottles per case). A line with no rotation or
 * no product code is not a holding and returns null.
 *
 * @example
 *   parseLcbStockRow({ Rotation: '26/D014659', Code: '1122750-2014-06-00750', Cases: '0', Singles: '3', SPC: '6' });
 *
 * @param row - The line, keyed by column header
 * @returns The holding, or null for a line that is not one
 */
const parseLcbStockRow = (row: LcbStockRow) => {
  const rotation = text(field(row, 'Rotation'));
  const code = text(field(row, 'Code'));

  if (!rotation || !code) return null;

  const bottlesPerCase = whole(field(row, 'SPC')) || null;
  const cases = whole(field(row, 'Cases'));
  const singles = whole(field(row, 'Singles'));
  const reported = whole(field(row, 'TSingles'));
  const totalBottles = reported || cases * (bottlesPerCase ?? 12) + singles;

  if (totalBottles <= 0) return null;

  /* Every reference column the line has, joined, so a code in any of them is found */
  const reference =
    Object.entries(row)
      .filter(([header]) => REFERENCE_KEYS.has(headerKey(header)))
      .map(([, value]) => text(value))
      .filter(Boolean)
      .join(' ') || null;

  const size = Number.parseFloat(String(field(row, 'SS') ?? ''));
  const year = whole(field(row, 'Year'));

  return {
    rotation,
    line: whole(field(row, 'Ln')),
    lwin18: normalizeLwin18(code),
    brand: text(field(row, 'Brand')),
    description: text(field(row, 'Description')),
    vintage: year >= 1800 && year <= 2200 ? year : null,
    bottlesPerCase,
    bottleSizeLitres: Number.isFinite(size) && size > 0 ? size : null,
    cases,
    singles,
    totalBottles,
    packaging: text(field(row, 'Packaging')),
    supplierName: text(field(row, 'Supplier Name')),
    receivedAt: ukDate(field(row, 'Received')),
    reference,
  };
};

export default parseLcbStockRow;
