import { describe, expect, it } from 'vitest';

import lwinPackAgnosticPattern from './lwinPackAgnosticPattern';
import parseSkuPack from './parseSkuPack';
import rankStockByPack from './rankStockByPack';
import readOrderedPack, { readOrderedPackOrNull } from './readOrderedPack';
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

describe('readOrderedPack', () => {
  /*
    A corrected code in Zoho has to reach the quantities, not only the match.
    NICE is twelve 180ml cans to a case and its Zoho item said "1x75cl": the
    order card read 40 cases as 40 bottles, and release would have shipped a
    twelfth of what was bought.
  */
  it('takes the pack from the SKU over a stale description', () => {
    expect(readOrderedPack('NICECANMAL-0000-12-00180', '1x75cl')).toBe(12);
    expect(readOrderedPack('BROTHERSB-0000-06-00750', '1x75cl')).toBe(6);
  });

  it('falls back to the description when the SKU carries no pack', () => {
    expect(readOrderedPack(null, '6x75cl')).toBe(6);
    expect(readOrderedPack('CB-ORCHARD', '6 x 70cl')).toBe(6);
  });

  it('is one bottle when neither says', () => {
    expect(readOrderedPack(null, null)).toBe(1);
    expect(readOrderedPack('', 'Blended Malt')).toBe(1);
  });

  /*
    The quantity path has to tell "one bottle" from "nobody said". CASA LOTOS
    came through as SOT-CAS-750-BTL-UAE-BLC — six segments, no pack — and the
    1 default read 20 cases as 20 bottles.
  */
  it('reports an unknown pack as null rather than one', () => {
    expect(readOrderedPackOrNull('SOT-CAS-750-BTL-UAE-BLC', null)).toBeNull();
    expect(readOrderedPackOrNull(null, 'Blended Malt')).toBeNull();
    expect(readOrderedPackOrNull(null, '6x75cl')).toBe(6);
    expect(readOrderedPackOrNull('1007808-2017-01-00750', null)).toBe(1);
  });
});

describe('resolvePickQuantities with an unreadable pack', () => {
  it('treats a Cases line as whole cases of the pack the stock is held in', () => {
    const result = resolvePickQuantities({
      sku: 'SOT-CAS-750-BTL-UAE-BLC',
      description: null,
      unit: 'Cases',
      quantity: 20,
      stockCaseConfig: 6,
    });

    expect(result.wholeCase).toBe(true);
    expect(result.casesNeeded).toBe(20);
    expect(result.quantityBottles).toBeNull();
    expect(result.orderedBottles).toBe(120);
  });

  it('still cracks a case for a Bottle line', () => {
    const result = resolvePickQuantities({
      sku: 'SOT-CAS-750-BTL-UAE-BLC',
      description: null,
      unit: 'Bottle',
      quantity: 20,
      stockCaseConfig: 6,
    });

    expect(result.wholeCase).toBe(false);
    expect(result.quantityBottles).toBe(20);
    expect(result.casesNeeded).toBe(4);
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

  /*
    SO-00133 reported 20 of 21 lines with no stock. Every one of them was a
    spirit or a canned wine — products with no vintage and a supplier SKU that
    is not a LWIN — so nothing anywhere in the line yielded a year, and the
    matcher refused every candidate on the "vintage must agree" guard rather
    than reading the line as non-vintage.
  */
  it('matches a spirit that states no vintage anywhere', () => {
    const whisky = stockRow({
      lwin18: 'W99000121-0000-06-00700',
      productName: 'Compass Box ORCHARD HOUSE Blended Malt Scottish Whisky',
      vintage: null,
      caseConfig: 6,
      quantityCases: 4,
      availableCases: 4,
      locationCode: 'D-01-02',
    });

    const result = resolveRepackFromStock([whisky], {
      name: 'Compass Box ORCHARD HOUSE Blended Malt Scottish Whisky',
      sku: 'CB-ORCHARD-6X70',
      description: '6x70cl - 46%',
      quantity: 3,
      unit: 'Cases',
    });

    expect(result.hasStock).toBe(true);
    expect(result.needsRepack).toBe(false);
    expect(result.suggestedLocation).toBe('D-01-02');
  });

  it('still refuses a vintaged row for a line that states no vintage', () => {
    const vintaged = stockRow({
      lwin18: '1104695-2015-06-00750',
      productName: 'Compass Box ORCHARD HOUSE Blended Malt Scottish Whisky',
      vintage: 2015,
    });

    const result = resolveRepackFromStock([vintaged], {
      name: 'Compass Box ORCHARD HOUSE Blended Malt Scottish Whisky',
      sku: 'CB-ORCHARD-6X70',
      description: '6x70cl - 46%',
      quantity: 1,
      unit: 'Cases',
    });

    expect(result.hasStock).toBe(false);
  });

  /*
    The producer is its own column in stock and is not repeated in the product
    name, while Zoho's line name leads with it. Requiring every word of the
    order name to appear in the product name alone therefore failed on the one
    word the warehouse keeps somewhere else — eleven lines of SO-00133, every
    one of them a spirit whose maker is named separately.
  */
  it('matches when the maker is in the producer column, not the name', () => {
    const whisky = stockRow({
      lwin18: 'ORCHARDHOU-0000-06-00700',
      productName: 'ORCHARD HOUSE Blended Malt Scottish Whiskey',
      producer: 'Compass Box',
      vintage: null,
      caseConfig: 6,
      quantityCases: 250,
      availableCases: 250,
      locationCode: 'D-01-02',
    });

    const result = resolveRepackFromStock([whisky], {
      name: 'Compass Box ORCHARD HOUSE Blended Malt Scottish Whisky',
      sku: 'ORCHARDHOU-0000-06-00700',
      description: '6x70cl - 46%',
      quantity: 3,
      unit: 'Cases',
    });

    expect(result.hasStock).toBe(true);
    expect(result.suggestedLocation).toBe('D-01-02');
  });

  /*
    The producer must widen the haystack, not loosen the match: every Compass
    Box bottling shares "Compass Box Blended Malt Scottish Whiskey", and only
    the bottling name tells them apart.
  */
  it('does not match a different bottling from the same producer', () => {
    const artist = stockRow({
      lwin18: 'ARTISTBLEN-0000-06-00700',
      productName: 'ARTIST BLEND Blended Malt Scottish Whiskey',
      producer: 'Compass Box',
      vintage: null,
    });

    const result = resolveRepackFromStock([artist], {
      name: 'Compass Box ORCHARD HOUSE Blended Malt Scottish Whisky',
      sku: 'ORCHARDHOU-0000-06-00700',
      description: '6x70cl - 46%',
      quantity: 1,
      unit: 'Cases',
    });

    expect(result.hasStock).toBe(false);
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
