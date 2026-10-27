export interface ParsedCells {
  text: (index: number | undefined) => string | null;
  number: (index: number | undefined) => number | null;
  date: (index: number | undefined) => string | null;
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * The calendar day a spreadsheet Date cell means
 *
 * SheetJS builds date cells at local midnight in the browser, so the UTC
 * reading of a cell entered as 31 July in Dubai (UTC+4) is 30 July 20:00 and
 * `toISOString()` filed it a day early. A value sitting exactly on UTC
 * midnight was built in UTC and is read as UTC; anything else is read in the
 * local zone it was built in.
 */
const calendarDay = (value: Date) =>
  value.getUTCHours() === 0 && value.getUTCMinutes() === 0
    ? value.toISOString().slice(0, 10)
    : `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

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
      return calendarDay(value);
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
      return calendarDay(value);
    }

    const asText = text(index);

    if (asText === null) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(asText)) {
      return asText;
    }

    // Day first, as UK and UAE documents write it: 31/07/2026, 31-07-26.
    // JS would read 01/07/2026 as 7 January.
    const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(asText);

    if (dayFirst) {
      let day = Number(dayFirst[1]);
      let month = Number(dayFirst[2]);

      // Only unmistakably month-first (07/31/2026) is read the other way
      if (month > 12 && day <= 12) {
        [day, month] = [month, day];
      }

      const rawYear = Number(dayFirst[3]);
      const year = dayFirst[3]!.length === 2 ? 2000 + rawYear : rawYear;

      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
      }

      return `${year}-${pad(month)}-${pad(day)}`;
    }

    const parsed = new Date(asText);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    // Free text such as "31 Jul 2026" parses at local midnight
    return calendarDay(parsed);
  };

  return { text, number, date };
};

export default parseCell;
