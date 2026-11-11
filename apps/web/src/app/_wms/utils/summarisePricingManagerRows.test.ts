import { describe, expect, it } from 'vitest';

import pricePricingManagerRow from './pricePricingManagerRow';
import summarisePricingManagerRows from './summarisePricingManagerRows';

const RATES = {
  ownerSelected: false,
  effInbondPct: 10,
  effPcPct: null,
  inBondMarkupPct: 10,
  pcMarginPct: 0,
};

/** The manual's worked example: landed 52.50, In Bond 20%, PC 25% */
const EXAMPLE = {
  lwin18: '1000001-2020-06-00750',
  category: 'Wine',
  importPricePerBottle: 50,
  systemLogistics: 0,
  transferPricePerBottle: 2.5,
  b2bMarginPct: 20,
  pcMarginPct: 25,
  bottles: 6,
};

describe('summarisePricingManagerRows', () => {
  it('prices the worked example as the row does', () => {
    const row = pricePricingManagerRow(EXAMPLE, RATES);

    expect(row.landed).toBeCloseTo(52.5, 2);
    expect(Math.round((row.inBond ?? 0) * 100) / 100).toBe(65.63);
    // PC is built from the rounded In Bond: 65.63 / 0.75
    expect(Math.round((row.sellPrice ?? 0) * 100) / 100).toBe(87.51);
  });

  it('sums the tiles from the row prices', () => {
    const tiles = summarisePricingManagerRows([EXAMPLE], RATES);

    expect(tiles.stockAtCost).toBe(315);
    expect(tiles.inBondValue).toBe(393.75);
    expect(tiles.pcValue).toBe(525.04);
    expect(tiles.potentialGrossProfit).toBe(78.75);
    expect(tiles.blendedMargin).toBe(20);
    expect(tiles.unpricedCount).toBe(0);
    expect(tiles.belowCostCount).toBe(0);
  });

  it('counts a row with no sell price as unpriced and one at cost as below cost', () => {
    const tiles = summarisePricingManagerRows(
      [
        { ...EXAMPLE, lwin18: 'a', b2bMarginPct: null, pcMarginPct: null },
        {
          ...EXAMPLE,
          lwin18: 'b',
          b2bMarginPct: null,
          pcMarginPct: null,
          sellingPricePerBottle: 50,
        },
      ],
      RATES,
    );

    expect(tiles.unpricedCount).toBe(1);
    expect(tiles.belowCostCount).toBe(1);
    expect(tiles.totalProducts).toBe(2);
  });
});
