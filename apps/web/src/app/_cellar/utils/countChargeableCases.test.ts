import { describe, expect, it } from 'vitest';

import countChargeableCases from './countChargeableCases';

const row = (
  quantityCases: number,
  caseConfig: number | null,
  bottleSize = '75cl',
  openBottles = 0,
) => ({ quantityCases, caseConfig, bottleSize, openBottles });

describe('countChargeableCases', () => {
  it('counts a 12-bottle case as one unit', () => {
    expect(countChargeableCases([row(3, 12)])).toBe(3);
  });

  it('counts a 6-bottle case, or anything up to 6 bottles, as half', () => {
    expect(countChargeableCases([row(2, 6)])).toBe(1);
    expect(countChargeableCases([row(1, 3)])).toBe(0.5);
    expect(countChargeableCases([row(1, 1)])).toBe(0.5);
  });

  it('measures large formats in standard bottles', () => {
    // 3 magnums = 6 bottles; 6 magnums = 12; an Imperial = 8
    expect(countChargeableCases([row(1, 3, '150cl')])).toBe(0.5);
    expect(countChargeableCases([row(1, 6, '150cl')])).toBe(1);
    expect(countChargeableCases([row(1, 1, '600cl')])).toBe(1);
  });

  it('rounds a case above 12 bottles up to the next six', () => {
    // 12 magnums = 24 bottles; 9 magnums = 18; a case of 13 rounds to 18
    expect(countChargeableCases([row(1, 12, '150cl')])).toBe(2);
    expect(countChargeableCases([row(1, 9, '150cl')])).toBe(1.5);
    expect(countChargeableCases([row(1, 13)])).toBe(1.5);
  });

  it('counts twelve half bottles as a 6-bottle case', () => {
    expect(countChargeableCases([row(1, 12, '37.5cl')])).toBe(0.5);
  });

  it('reads sizes in ml, cl and litres alike', () => {
    expect(countChargeableCases([row(1, 6, '1500ml')])).toBe(1);
    expect(countChargeableCases([row(1, 6, '1.5L')])).toBe(1);
    expect(countChargeableCases([row(1, 6, '150cl')])).toBe(1);
  });

  it('pools loose bottles into sixes, each six or part half a unit', () => {
    expect(countChargeableCases([row(0, 6, '75cl', 4), row(0, 12, '75cl', 3)])).toBe(1);
    expect(countChargeableCases([row(0, 6, '75cl', 6)])).toBe(0.5);
  });

  it('counts a loose magnum as two bottles', () => {
    expect(countChargeableCases([row(0, 1, '150cl', 3)])).toBe(0.5);
    expect(countChargeableCases([row(0, 1, '150cl', 4)])).toBe(1);
  });

  it('treats an unknown pack as twelve', () => {
    expect(countChargeableCases([row(1, null)])).toBe(1);
  });

  it('is zero for an empty cellar', () => {
    expect(countChargeableCases([])).toBe(0);
  });
});
