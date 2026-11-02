import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import parseOutletSalesReport, {
  monthFromHeading,
} from './parseOutletSalesReport';

/** City Drinks' real August 2026 report, kept verbatim */
const workbook = fs
  .readFileSync(path.join(__dirname, 'augustSales.fixture.xlsx'))
  .toString('base64');

describe('parseOutletSalesReport', () => {
  const parsed = parseOutletSalesReport(workbook, 2026);

  it('reads the month from the column heading', () => {
    expect(parsed.month).toBe('2026-08');
    expect(parsed.monthLabel).toBe('August');
  });

  it('takes the 57 lines that sold, and 352 bottles', () => {
    expect(parsed.counts.sold).toBe(57);
    expect(parsed.counts.bottles).toBe(352);
  });

  /*
    The sheet lists every consigned wine they hold; a blank means it did not
    sell. Dropping those silently would lose the fact that we know it sold
    nothing, which is different from not knowing.
  */
  it('counts the listed-but-unsold rather than dropping them', () => {
    expect(parsed.counts.noQuantity).toBeGreaterThan(30);
    // Every row on the sheet lands in exactly one bucket, totals included
    expect(parsed.counts.rows).toBe(
      parsed.counts.sold +
        parsed.counts.noQuantity +
        parsed.counts.unreadable +
        parsed.counts.totals,
    );
  });

  it('keys on the outlet code, since that is all they give', () => {
    const line = parsed.lines.find((row) => row.outletCode === 'CDR3846069263');

    expect(line?.bottles).toBe(19);
    expect(line?.productName).toContain('Montille');
  });

  /*
    The report ends with a Grand Total row whose CODE column reads "Total"
    rather than being empty. Read as a wine it added 352 bottles to a
    352-bottle month and doubled it exactly — wrong in a way that looks
    entirely plausible.
  */
  it('reads the Grand Total as a check, not as a wine', () => {
    expect(parsed.declaredBottles).toBe(352);
    expect(parsed.counts.bottles).toBe(352);
    expect(parsed.agrees).toBe(true);
    expect(parsed.lines.some((line) => /total/i.test(line.outletCode))).toBe(
      false,
    );
  });
});

describe('the month heading as City Drinks write it', () => {
  /*
    They headed August "August" and September "Sales September". An exact
    match rejected the whole file for the word in front of the month.
  */
  it.each([
    ['August', '2026-08'],
    ['Sales September', '2026-09'],
    ['  sales  october ', '2026-10'],
    ['Sales December', '2026-12'],
  ])('reads %s', (heading, expected) => {
    expect(monthFromHeading(heading, 2026)).toBe(expected);
  });

  it('refuses a heading naming no month', () => {
    expect(monthFromHeading('Quantity', 2026)).toBeNull();
  });
});

describe('parseOutletSalesReport, a workbook with a hidden pivot first', () => {
  /*
    As City Drinks sent October 2026: a hidden tab of the whole history,
    headed on row 4 with many months, then the month's report visible.
  */
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      [null, null, null, 'created_at'],
      [null, null, null, 'Qty sold'],
      [null, null, null, 2024],
      ['Vendor', 'code', 'product_name_new', 'March', 'April'],
      ['Craft & Culture', 'CDR6645813799', 'Tenuta San Guido Sassicaia 2019', 1, 4],
    ]),
    'Sheet 1',
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      ['Vendor', 'Code', 'product_name_new', 'October'],
      ['Craft & Culture', 'CDR6645813799', 'Tenuta San Guido Sassicaia 2019', null],
      [null, 'CDR2341469877', 'Tenuta San Guido Sassicaia 2020', 3],
      [null, 'CDR3846069263', 'Domaine de Montille Chassagne-Montrachet 2022', 12],
    ]),
    'Sheet 1 (2)',
  );
  book.Workbook = { Sheets: [{ name: 'Sheet 1', Hidden: 1 }, { name: 'Sheet 1 (2)', Hidden: 0 }] };

  const parsed = parseOutletSalesReport(XLSX.write(book, { type: 'base64', bookType: 'xlsx' }) as string, 2026);

  it('reads the visible report, not the hidden pivot', () => {
    expect(parsed.month).toBe('2026-10');
    expect(parsed.lines).toEqual([
      { outletCode: 'CDR2341469877', productName: 'Tenuta San Guido Sassicaia 2020', bottles: 3 },
      { outletCode: 'CDR3846069263', productName: 'Domaine de Montille Chassagne-Montrachet 2022', bottles: 12 },
    ]);
    expect(parsed.counts.noQuantity).toBe(1);
  });

  it('finds a heading row below the top of the sheet', () => {
    const pivotOnly = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(pivotOnly, book.Sheets['Sheet 1']!, 'Sheet 1');
    const pivot = parseOutletSalesReport(XLSX.write(pivotOnly, { type: 'base64', bookType: 'xlsx' }) as string, 2026);

    expect(pivot.month).toBe('2026-03');
    expect(pivot.lines).toEqual([{ outletCode: 'CDR6645813799', productName: 'Tenuta San Guido Sassicaia 2019', bottles: 1 }]);
  });
});
