import { describe, expect, it } from 'vitest';

import checkOrderLines, { type CheckContext, statedPackAndSize } from './checkOrderLines';

const TALBOT = '1012781-2016-06-00750';
const KEY = '1012781-2016-00750';

const ctx = (over: Partial<CheckContext> = {}): CheckContext => ({
  currency: 'USD',
  toUsd: 1,
  listPerBottle: new Map([[KEY, 50]]),
  stockBottles: new Map([[KEY, 36]]),
  comparePrices: true,
  ...over,
});

const codes = (r: ReturnType<typeof checkOrderLines>, i = 0) => r.lines[i]!.issues.map((x) => x.code);

describe('statedPackAndSize', () => {
  it('reads pack and size in cl, ml or litres', () => {
    expect(statedPackAndSize('Talbot 2016 (6x75cl)')).toEqual({ pack: 6, sizeMl: 750 });
    expect(statedPackAndSize('Krug 1x 1.5l')).toEqual({ pack: 1, sizeMl: 1500 });
    expect(statedPackAndSize('Magnum 150cl')).toEqual({ pack: null, sizeMl: 1500 });
  });
});

describe('checkOrderLines', () => {
  it('passes a clean line', () => {
    const r = checkOrderLines([{ name: 'Château Talbot 2016 (6x75cl)', sku: TALBOT, rate: 330, quantity: 2, itemTotal: 660 }], ctx());
    expect(r.counts).toEqual({ error: 0, warning: 0, info: 0 });
    expect(r.lines[0]!.perBottleUsd).toBe(55);
  });

  it('accepts a code without dashes', () => {
    const r = checkOrderLines([{ name: 'Talbot 2016 (6x75cl)', sku: '101278120160600750', rate: 330, quantity: 1 }], ctx());
    expect(codes(r)).toEqual([]);
  });

  it('flags a missing or broken code', () => {
    const r = checkOrderLines(
      [
        { name: 'Talbot 2016', sku: null, rate: 330, quantity: 1 },
        { name: 'Talbot 2016', sku: 'TALBOT-16', rate: 330, quantity: 1 },
      ],
      ctx(),
    );
    expect(codes(r, 0)).toContain('NO_CODE');
    expect(codes(r, 1)).toContain('BAD_CODE');
  });

  it('flags a code whose pack, size or vintage disagrees with the name', () => {
    const r = checkOrderLines(
      [
        { name: 'Talbot 2016 (3x75cl)', sku: TALBOT, rate: 165, quantity: 1 },
        { name: 'Talbot 2016 (6x150cl)', sku: TALBOT, rate: 330, quantity: 1 },
        { name: 'Talbot 2015 (6x75cl)', sku: TALBOT, rate: 330, quantity: 1 },
      ],
      ctx(),
    );
    expect(codes(r, 0)).toContain('PACK_MISMATCH');
    expect(codes(r, 1)).toContain('SIZE_MISMATCH');
    expect(codes(r, 2)).toContain('VINTAGE_MISMATCH');
  });

  it('flags no price, below list, and the same wine twice', () => {
    const r = checkOrderLines(
      [
        { name: 'Talbot 2016 (6x75cl)', sku: TALBOT, rate: 0, quantity: 1 },
        { name: 'Talbot 2016 (6x75cl)', sku: TALBOT, rate: 240, quantity: 1 },
      ],
      ctx(),
    );
    expect(codes(r, 0)).toContain('NO_PRICE');
    expect(codes(r, 1)).toEqual(expect.arrayContaining(['BELOW_LIST', 'DUPLICATE']));
  });

  it('reads a bottle-unit rate as per bottle', () => {
    const r = checkOrderLines([{ name: 'Talbot 2016 (6x75cl)', sku: TALBOT, rate: 55, quantity: 2, unit: 'Bottle' }], ctx());
    expect(r.lines[0]!.perBottleUsd).toBe(55);
    expect(codes(r)).toEqual([]);
  });

  it('spots USD figures on an AED document', () => {
    const lines = [0, 1, 2].map(() => ({ name: 'Talbot 2016 (6x75cl)', sku: TALBOT, rate: 330, quantity: 1 }));
    const r = checkOrderLines(lines, ctx({ currency: 'AED', toUsd: 0.2723 }));
    expect(r.documentIssues.map((d) => d.code)).toContain('CURRENCY_MIXUP');
  });

  it('flags wine we do not hold, and a total above rate × quantity', () => {
    const r = checkOrderLines(
      [{ name: 'Talbot 2016 (6x75cl)', sku: TALBOT, rate: 330, quantity: 2, itemTotal: 990 }],
      ctx({ stockBottles: new Map() }),
    );
    expect(codes(r)).toEqual(expect.arrayContaining(['NOT_HELD', 'TOTAL_MISMATCH']));
  });

  it('skips heading rows', () => {
    const r = checkOrderLines([{ name: 'CONSIGNMENT_CC', rate: 0, quantity: 0, isHeader: true }], ctx());
    expect(r.counts.error).toBe(0);
  });
});
