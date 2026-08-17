import { describe, expect, it } from 'vitest';

import lwinPackAgnosticPattern from './lwinPackAgnosticPattern';
import parseSkuPack from './parseSkuPack';
import rankStockByPack from './rankStockByPack';
import resolvePickQuantities from './resolvePickQuantities';
import resolveRepackFromStock from './resolveRepackFromStock';

/**
 * Every case below is a failure that reached the warehouse floor. They are
 * written from the real data that caused them so the same break cannot ship
 * twice.
 */

const stockRow = (over: Partial<Parameters<typeof resolveRepackFromStock>[0][number]> = {}) => ({
  lwin18: '1104695-2015-06-00750',
  productName: 'Luciano Sandrone, Barbera d’Alba',
  vintage: 2015,
  caseConfig: 6,
  quantityCases: 2,
  availableCases: 2,
  openBottles: 0,
  locationCode: 'C-04-00',
  ...over,
});

describe('resolvePickQuantities', () => {
  it('picks ONE bottle when a single is ordered off a 6-pack (PL-2026-0043)', () => {
    // The sheet printed "1 case · 6 btl" for an order of one bottle.
    const result = resolvePickQuantities({
      quantity: 1,
      unit: 'Case',
      description: '1x75cl',
      sku: '1007808-2017-01-00750',
      stockCaseConfig: 6,
    });

    expect(result.orderedPack).toBe(1);
    expect(result.orderedBottles).toBe(1);
    expect(result.quantityBottles).toBe(1);
    expect(result.wholeCase).toBe(false);
    expect(result.casesNeeded).toBe(1);
  });

  it('tolerates the space in "1 x75cl"', () => {
    const result = resolvePickQuantities({
      quantity: 1,
      unit: 'Case',
      description: '1 x75cl',
      sku: null,
      stockCaseConfig: 6,
    });
    expect(result.quantityBottles).toBe(1);
  });

  it('leaves a matching full-case order as a case pick', () => {
    const result = resolvePickQuantities({
      quantity: 2,
      unit: 'Cases',
      description: '6x75cl',
      sku: '1014525-2019-06-00750',
      stockCaseConfig: 6,
    });

    expect(result.wholeCase).toBe(true);
    expect(result.quantityBottles).toBeNull();
    expect(result.casesNeeded).toBe(2);
  });

  it('breaks one 6-pack for a 3-pack order (Chapoutier)', () => {
    const result = resolvePickQuantities({
      quantity: 1,
      unit: 'Case',
      description: '3x75cl',
      sku: '1109704-2008-03-00750',
      stockCaseConfig: 6,
    });

    expect(result.orderedBottles).toBe(3);
    expect(result.quantityBottles).toBe(3);
    expect(result.casesNeeded).toBe(1);
  });

  it('counts a bottle-unit line in bottles', () => {
    const result = resolvePickQuantities({
      quantity: 4,
      unit: 'Bottle',
      description: '6x75cl',
      sku: '1014525-2019-06-00750',
      stockCaseConfig: 6,
    });

    expect(result.orderedBottles).toBe(4);
    expect(result.quantityBottles).toBe(4);
    expect(result.wholeCase).toBe(false);
  });
});

describe('parseSkuPack', () => {
  it('reads the pack off a dashed LWIN18', () => {
    expect(parseSkuPack('1014525-2019-06-00750')).toEqual({
      pack: 6,
      bottleSize: '75cl',
    });
  });

  it('reads a compact 18-digit SKU', () => {
    expect(parseSkuPack('101452520190600750')?.pack).toBe(6);
  });

  it('rejects corrupt pack digits (the 66/62 SKUs that showed 264 bottles)', () => {
    expect(parseSkuPack('106313220206600750')).toBeNull();
    expect(parseSkuPack('124356120206200750')).toBeNull();
  });

  it('reads supplier codes that are not 7-digit LWINs', () => {
    expect(parseSkuPack('W12008024-2021-06-00750')?.pack).toBe(6);
  });

  it('reads a single-bottle pack', () => {
    expect(parseSkuPack('1007808-2017-01-00750')?.pack).toBe(1);
  });
});

describe('lwinPackAgnosticPattern', () => {
  it('ignores the pack but keeps the bottle size', () => {
    expect(lwinPackAgnosticPattern('1109704-2008-03-00750')).toBe(
      '1109704-2008-%-00750',
    );
  });

  it('works for supplier codes', () => {
    expect(lwinPackAgnosticPattern('W12008024-2021-06-00750')).toBe(
      'W12008024-2021-%-00750',
    );
  });

  it('returns null for anything not in that shape', () => {
    expect(lwinPackAgnosticPattern('GIN-LANG')).toBeNull();
    expect(lwinPackAgnosticPattern(null)).toBeNull();
  });
});

describe('rankStockByPack', () => {
  it('prefers the exact pack, then the smallest breakable case', () => {
    const ranked = rankStockByPack(
      [
        { caseConfig: 12, availableCases: 5 },
        { caseConfig: 6, availableCases: 5 },
        { caseConfig: 3, availableCases: 5 },
      ],
      3,
    );
    expect(ranked.map((r) => r.caseConfig)).toEqual([3, 6, 12]);
  });

  it('puts bays holding nothing available last', () => {
    const ranked = rankStockByPack(
      [
        { caseConfig: 6, availableCases: 0 },
        { caseConfig: 6, availableCases: 2 },
      ],
      6,
    );
    expect(ranked[0]?.availableCases).toBe(2);
  });
});

describe('resolveRepackFromStock', () => {
  const line = {
    name: 'Luciano Sandrone, Barbera d’Alba 2015 (Single)',
    sku: '1104695-2015-01-00750',
    description: '1x75cl',
    quantity: 1,
    unit: 'Case',
  };

  it('finds the 6-pack for a single-bottle line and flags the break', () => {
    const result = resolveRepackFromStock([stockRow()], line);

    expect(result.hasStock).toBe(true);
    expect(result.needsRepack).toBe(true);
    expect(result.fromPack).toBe(6);
    expect(result.suggestedLocation).toBe('C-04-00');
  });

  it('counts loose bottles as stock (0 cases, 5 open)', () => {
    const result = resolveRepackFromStock(
      [stockRow({ quantityCases: 0, availableCases: 0, openBottles: 5 })],
      line,
    );

    expect(result.hasStock).toBe(true);
    expect(result.suggestedLocation).toBe('C-04-00');
  });

  it('will not match a different vintage of the same wine', () => {
    const result = resolveRepackFromStock(
      [stockRow({ lwin18: '1104695-2016-06-00750', vintage: 2016 })],
      line,
    );

    expect(result.hasStock).toBe(false);
  });

  it('matches across an accent (François vs Francois)', () => {
    const result = resolveRepackFromStock(
      [
        stockRow({
          lwin18: 'W12008024-2021-06-00750',
          productName: 'Francois Thienpont Terre Elysée',
          vintage: 2021,
        }),
      ],
      {
        name: 'François Thienpont Terre Elysée 2021',
        sku: '1243561-2021-06-00750',
        description: '6x75cl',
        quantity: 3,
        unit: 'Cases',
      },
    );

    expect(result.hasStock).toBe(true);
  });

  it('matches a name glued to its vintage by an underscore', () => {
    const result = resolveRepackFromStock(
      [
        stockRow({
          lwin18: '1012316-1993-02-00750',
          productName: 'Latour',
          vintage: 1993,
          caseConfig: 2,
        }),
      ],
      {
        name: 'Latour_1993',
        sku: '1013821-1993-02-00750',
        description: '2x75cl',
        quantity: 2,
        unit: 'Cases',
      },
    );

    expect(result.hasStock).toBe(true);
  });

  it('treats BOTH LWIN non-vintage markers as NV', () => {
    const nvStock = stockRow({
      lwin18: 'W307002244-0000-06-00750',
      productName: 'Valentin Leflaive Champagne Sigma 20 4.0',
      vintage: null,
      quantityCases: 3,
      availableCases: 3,
      locationCode: 'B-05-01',
    });

    // '1000' is truthy as a number — it was being compared as vintage 1000.
    for (const sku of ['2665483-1000-06-00750', '2665483-0000-06-00750']) {
      const result = resolveRepackFromStock([nvStock], {
        name: 'Valentin Leflaive Champagne Sigma 20 4.0',
        sku,
        description: '6x75cl',
        quantity: 3,
        unit: 'Cases',
      });
      expect(result.hasStock).toBe(true);
      expect(result.suggestedLocation).toBe('B-05-01');
    }
  });

  it('suggests a bay that holds enough, not merely the best pack fit', () => {
    const result = resolveRepackFromStock(
      [
        stockRow({
          lwin18: '1012316-1993-02-00750',
          caseConfig: 2,
          quantityCases: 1,
          availableCases: 1,
          locationCode: 'B-04-01',
        }),
        stockRow({
          lwin18: '1012316-1993-02-00750',
          caseConfig: 2,
          quantityCases: 2,
          availableCases: 2,
          locationCode: 'B-02-01',
        }),
      ],
      {
        name: 'Latour',
        sku: '1012316-1993-02-00750',
        description: '2x75cl',
        quantity: 2,
        unit: 'Cases',
      },
    );

    expect(result.suggestedLocation).toBe('B-02-01');
  });
});
