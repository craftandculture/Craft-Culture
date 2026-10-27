import { describe, expect, it } from 'vitest';

import planStockOut from './planStockOut';

const row = { quantityCases: 5, availableCases: 5, openBottles: 0, pack: 6 };

describe('planStockOut', () => {
  it('takes whole cases', () => {
    expect(planStockOut(row, 'case', 2)).toMatchObject({ ok: true, casesRemoved: 2, bottlesOut: 12, leftover: 0 });
  });

  it('opens a case for bottles and leaves the rest as singles', () => {
    expect(planStockOut(row, 'bottle', 2)).toMatchObject({ ok: true, casesRemoved: 1, bottlesOut: 2, leftover: 4 });
  });

  it('uses loose bottles before opening a case', () => {
    expect(planStockOut({ ...row, openBottles: 3 }, 'bottle', 2)).toMatchObject({ casesRemoved: 0, leftover: 1, openBottlesUsed: 2 });
  });

  it('never takes reserved cases', () => {
    expect(planStockOut({ ...row, availableCases: 1 }, 'case', 2).ok).toBe(false);
    expect(planStockOut({ ...row, availableCases: 0 }, 'bottle', 1).ok).toBe(false);
  });

  it('treats a singles row as bottles either way', () => {
    expect(planStockOut({ ...row, pack: 1 }, 'bottle', 3)).toMatchObject({ casesRemoved: 3, bottlesOut: 3 });
  });

  it('refuses nothing or a fraction', () => {
    expect(planStockOut(row, 'case', 0).ok).toBe(false);
    expect(planStockOut(row, 'bottle', 1.5).ok).toBe(false);
  });
});
