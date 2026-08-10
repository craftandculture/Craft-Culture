export interface ParsedCells {
  text: (index: number | undefined) => string | null;
  number: (index: number | undefined) => number | null;
  date: (index: number | undefined) => string | null;
}

/**
 * Build typed accessors over one spreadsheet row
 *
 * Exports arrive with quantities as "1,234", prices as "$85.00" and dates as
 * either real Date cells or free text, so every read goes through a coercion
 * that returns null rather than NaN when a cell cannot be understood.
 *
 * @param row - The raw cell values for a single row
 * @returns Accessors that coerce a column index to text, number or ISO date
 */
const parseCell = (row: unknown[]): ParsedCells => {
  const at = (index: number | undefined) =>
    index === undefined ? null : (row[index] ?? null);

  const text = (index: number | undefined) => {
    const value = at(index);

    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    const asText = String(value).trim();

    return asText === '' ? null : asText;
  };

  const number = (index: number | undefined) => {
    const value = at(index);

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const asText = text(index);

    if (asText === null) {
      return null;
    }

    // Strip thousands separators, currency symbols and stray spaces, and read
    // a parenthesised figure as the negative it is in accounting exports.
    const isNegative = /^\(.*\)$/.test(asText);
    const cleaned = asText.replace(/[()]/g, '').replace(/[^0-9.-]/g, '');
    const parsed = Number.parseFloat(cleaned);

    if (!Number.isFinite(parsed)) {
      return null;
    }

    return isNegative ? -parsed : parsed;
  };

  const date = (index: number | undefined) => {
    const value = at(index);

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    const asText = text(index);

    if (asText === null) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(asText)) {
      return asText;
    }

    const parsed = new Date(asText);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString().slice(0, 10);
  };

  return { text, number, date };
};

export default parseCell;
