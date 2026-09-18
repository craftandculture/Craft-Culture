import * as XLSX from 'xlsx';

export interface OutletSalesLine {
  /** The outlet's own code, e.g. City Drinks' CDR… */
  outletCode: string;
  productName: string;
  bottles: number;
}

export interface ParsedOutletSales {
  /**
   * The total the sheet states for itself, if it carries one.
   *
   * City Drinks end their report with a Grand Total row, and it is the
   * document checking our reading of it rather than a line to discard.
   */
  declaredBottles: number | null;
  /** Whether our sum agrees with the sheet's own total */
  agrees: boolean;
  /** The month the column named, as YYYY-MM */
  month: string;
  monthLabel: string;
  lines: OutletSalesLine[];
  counts: {
    rows: number;
    sold: number;
    bottles: number;
    /** Rows with a code but no quantity — listed on the sheet, sold nothing */
    noQuantity: number;
    /** Rows that could not be read at all */
    unreadable: number;
    /** Totals rows, counted so every row on the sheet is accounted for */
    totals: number;
  };
  skipped: string[];
}

/**
 * A totals row, not a wine.
 *
 * City Drinks close their report with `Grand Total`, and — this is the trap —
 * its code column reads "Total" rather than being empty. Taken as a product it
 * added 352 bottles to a 352-bottle month and doubled it exactly, which is the
 * kind of wrong that looks plausible.
 */
const TOTALS_ROW = /^(grand\s+)?total$|^sum$|^subtotal$/i;

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/**
 * Work out which month a column names
 *
 * The sheet heads its quantity column with a bare month — "August" — and
 * nothing anywhere states the year. Taken from the year the report is being
 * filed for rather than assumed to be now: a January report read in February
 * would otherwise land in the wrong year, and a December one read in January
 * would be out by twelve months.
 */
const monthFromHeading = (heading: string, year: number) => {
  const index = MONTHS.indexOf(heading.trim().toLowerCase());

  if (index < 0) return null;

  return `${year}-${String(index + 1).padStart(2, '0')}`;
};

/**
 * Read an outlet's monthly sales report
 *
 * City Drinks send four columns — Vendor, Code, Product Name, and the month —
 * keyed on **their** code, with no price and no owner. Both are supplied from
 * our side: the price from the invoices that put the wine there, the owner
 * from the wine.
 *
 * A row with a code and no quantity is not an error. The sheet lists every
 * consigned wine they hold, and a blank means it did not sell — which is a
 * fact worth keeping rather than a line to drop.
 *
 * @param base64 - The uploaded workbook
 * @param year - The year the report covers; the sheet only names the month
 * @returns The lines, the month, and what could not be read
 */
const parseOutletSalesReport = (
  base64: string,
  year: number,
): ParsedOutletSales => {
  const payload = base64.includes(',')
    ? base64.slice(base64.indexOf(',') + 1)
    : base64;

  const workbook = XLSX.read(Buffer.from(payload, 'base64'), { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;

  if (!sheet) throw new Error('That workbook has no sheets');

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  const first = rows[0];

  if (!first) throw new Error('That sheet has no rows');

  const headings = Object.keys(first);
  const codeKey = headings.find((key) => /code/i.test(key));
  const nameKey = headings.find((key) => /product|name|description/i.test(key));
  const monthKey = headings.find((key) => monthFromHeading(key, year));

  if (!codeKey) {
    throw new Error(
      `No code column found. The sheet has: ${headings.join(', ')}`,
    );
  }

  if (!monthKey) {
    throw new Error(
      `No month column found — one heading must be a month name. The sheet has: ${headings.join(', ')}`,
    );
  }

  const month = monthFromHeading(monthKey, year)!;
  const lines: OutletSalesLine[] = [];
  const skipped: string[] = [];
  let noQuantity = 0;
  let unreadable = 0;
  let declaredBottles: number | null = null;
  let totals = 0;

  for (const row of rows) {
    const outletCode = String(row[codeKey] ?? '').trim();
    const productName = String(row[nameKey ?? ''] ?? '').trim();
    const vendor = String(row[headings[0] ?? ''] ?? '').trim();

    /*
      The sheet's own total, kept as the check it is. Recognised on any of the
      three columns, because which one carries the word varies.
    */
    if (
      TOTALS_ROW.test(vendor) ||
      TOTALS_ROW.test(outletCode) ||
      TOTALS_ROW.test(productName)
    ) {
      const stated = Number(row[monthKey] ?? 0);

      if (Number.isFinite(stated) && stated > 0) declaredBottles = stated;

      totals += 1;

      continue;
    }

    if (!outletCode) {
      if (productName) {
        unreadable += 1;
        skipped.push(`${productName} — no code, so it cannot be identified`);
      }

      continue;
    }

    const raw = row[monthKey];
    const bottles = typeof raw === 'number' ? raw : Number(raw ?? 0);

    if (!Number.isFinite(bottles) || bottles === 0) {
      // Listed but unsold. A fact, not a fault.
      noQuantity += 1;
      continue;
    }

    lines.push({ outletCode, productName, bottles });
  }

  const bottles = lines.reduce((sum, line) => sum + line.bottles, 0);

  return {
    month,
    monthLabel: monthKey,
    lines,
    declaredBottles,
    /*
      Reported, never corrected. A sheet that does not add up is a question for
      the outlet, and quietly reconciling to their total would hide a line we
      failed to read.
    */
    agrees: declaredBottles === null || declaredBottles === bottles,
    counts: {
      rows: rows.length,
      sold: lines.length,
      bottles,
      noQuantity,
      unreadable,
      totals,
    },
    skipped,
  };
};

export default parseOutletSalesReport;
