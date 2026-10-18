import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';

/** One line of LCB's Rotation Stock report, as the spreadsheet gives it */
export type LcbStockRow = Record<string, string | number | null | undefined>;

/** The columns an import cannot do without */
export const LCB_REQUIRED_COLUMNS = ['Rotation', 'Code', 'Cases', 'Singles'] as const;

const text = (value: unknown) => {
  const trimmed = String(value ?? '').replace(/\s+/g, ' ').trim();
  return trimmed || null;
};

const whole = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? '').replace(/,/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** "30/09/2026 00:00:00", as Vision writes it, read as a UK date */
const ukDate = (value: unknown) => {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(value ?? '').trim());
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
  const rotation = text(row.Rotation);
  const code = text(row.Code);

  if (!rotation || !code) return null;

  const bottlesPerCase = whole(row.SPC) || null;
  const cases = whole(row.Cases);
  const singles = whole(row.Singles);
  const reported = whole(row.TSingles);
  const totalBottles = reported || cases * (bottlesPerCase ?? 12) + singles;

  if (totalBottles <= 0) return null;

  const size = Number.parseFloat(String(row.SS ?? ''));
  const year = whole(row.Year);

  return {
    rotation,
    line: whole(row.Ln),
    lwin18: normalizeLwin18(code),
    brand: text(row.Brand),
    description: text(row.Description),
    vintage: year >= 1800 && year <= 2200 ? year : null,
    bottlesPerCase,
    bottleSizeLitres: Number.isFinite(size) && size > 0 ? size : null,
    cases,
    singles,
    totalBottles,
    packaging: text(row.Packaging),
    receivedAt: ukDate(row.Received),
  };
};

export default parseLcbStockRow;
