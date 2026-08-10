import { describe, expect, it } from 'vitest';

import detectHeaderRow from './detectHeaderRow';
import guessColumnMapping from './guessColumnMapping';
import normalizeCode from './normalizeCode';
import parseCell from './parseCell';
import toBottles from './toBottles';

describe('normalizeCode', () => {
  it('resolves the same code written different ways', () => {
    expect(normalizeCode('cd-1234 ')).toBe('CD1234');
    expect(normalizeCode('CD 1234')).toBe('CD1234');
    expect(normalizeCode('CD_1234')).toBe('CD1234');
  });

  it('returns an empty string for nothing usable', () => {
    expect(normalizeCode(null)).toBe('');
    expect(normalizeCode('  ')).toBe('');
  });
});

describe('toBottles', () => {
  it('leaves bottle quantities alone', () => {
    expect(toBottles(12, 'bottle', 6)).toBe(12);
  });

  it('multiplies case quantities by the pack size', () => {
    expect(toBottles(2, 'case', 6)).toBe(12);
    expect(toBottles(1, 'case', 3)).toBe(3);
  });

  it('falls back to a 6-pack rather than zeroing a case line', () => {
    expect(toBottles(2, 'case', null)).toBe(12);
    expect(toBottles(2, 'case', 0)).toBe(12);
  });
});

describe('parseCell', () => {
  it('reads numbers written with separators and currency symbols', () => {
    const cells = parseCell(['1,234.50', '$85.00', '(12)']);

    expect(cells.number(0)).toBe(1234.5);
    expect(cells.number(1)).toBe(85);
    expect(cells.number(2)).toBe(-12);
  });

  it('returns null rather than NaN for unreadable cells', () => {
    const cells = parseCell(['n/a', null]);

    expect(cells.number(0)).toBeNull();
    expect(cells.number(1)).toBeNull();
    expect(cells.number(undefined)).toBeNull();
  });

  it('normalises dates from Date cells and text', () => {
    const cells = parseCell([new Date(Date.UTC(2026, 6, 31)), '2026-07-31', 'nonsense']);

    expect(cells.date(0)).toBe('2026-07-31');
    expect(cells.date(1)).toBe('2026-07-31');
    expect(cells.date(2)).toBeNull();
  });
});

describe('detectHeaderRow', () => {
  it('skips title rows above the real headers', () => {
    const matrix = [
      ['City Drinks — Sales Report', null, null],
      [null, null, null],
      ['Item Code', 'Description', 'Qty Sold'],
      ['CD1234', 'Duroche Gevrey', 6],
    ];

    expect(detectHeaderRow(matrix)).toBe(2);
  });
});

describe('guessColumnMapping', () => {
  it('matches the columns a City Drinks sales sheet uses', () => {
    const mapping = guessColumnMapping([
      'Item Code',
      'Description',
      'Vintage',
      'Qty Sold',
      'Invoice Date',
    ]);

    expect(mapping.rawCode).toBe(0);
    expect(mapping.rawDescription).toBe(1);
    expect(mapping.rawVintage).toBe(2);
    expect(mapping.quantity).toBe(3);
    expect(mapping.docDate).toBe(4);
  });

  it('keeps an invoice number and an invoice date apart', () => {
    const mapping = guessColumnMapping([
      'Invoice Number',
      'Invoice Date',
      'Item Name',
      'SKU',
      'Quantity',
      'Item Price',
    ]);

    expect(mapping.docRef).toBe(0);
    expect(mapping.docDate).toBe(1);
    expect(mapping.rawDescription).toBe(2);
    expect(mapping.rawCode).toBe(3);
    expect(mapping.quantity).toBe(4);
    expect(mapping.unitPrice).toBe(5);
  });

  it('never maps two fields onto the same column', () => {
    const mapping = guessColumnMapping(['Code', 'Product', 'Quantity']);
    const used = Object.values(mapping);

    expect(new Set(used).size).toBe(used.length);
  });
});
