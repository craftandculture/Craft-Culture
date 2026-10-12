import { describe, expect, it } from 'vitest';

import countChargeableCases from './countChargeableCases';

describe('countChargeableCases', () => {
  it('counts a sealed case as one whatever it holds', () => {
    expect(countChargeableCases([{ quantityCases: 2, openBottles: 0, bottleSize: '1500ml' }])).toBe(2);
  });

  it('pools loose bottles into cases of six, rounding up', () => {
    expect(
      countChargeableCases([
        { quantityCases: 0, openBottles: 4, bottleSize: '750ml' },
        { quantityCases: 0, openBottles: 3, bottleSize: '750ml' },
      ]),
    ).toBe(2);
  });

  it('counts a loose magnum as two bottles', () => {
    expect(countChargeableCases([{ quantityCases: 0, openBottles: 3, bottleSize: '1500ml' }])).toBe(1);
    expect(countChargeableCases([{ quantityCases: 0, openBottles: 4, bottleSize: '1500ml' }])).toBe(2);
  });

  it('treats a half bottle as one bottle', () => {
    expect(countChargeableCases([{ quantityCases: 1, openBottles: 1, bottleSize: '375ml' }])).toBe(2);
  });

  it('is zero for an empty cellar', () => {
    expect(countChargeableCases([])).toBe(0);
  });
});
