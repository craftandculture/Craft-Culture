import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import parseOutletSalesReport from './parseOutletSalesReport';

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
