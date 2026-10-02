import { describe, expect, it } from 'vitest';

import priceLine from './priceLine';
import roundMoney from './roundMoney';

describe('priceLine', () => {
  it('converts the net amount at the peg', () => {
    expect(priceLine(617.71, 1, 3.6725)).toEqual({ unitPrice: 2268.54, amount: 2268.54 });
  });

  it('always multiplies out', () => {
    for (const [net, qty] of [[136.4, 5], [1242.09, 3], [3282.06, 2], [195.51, 7]] as const) {
      const { unitPrice, amount } = priceLine(net, qty, 3.6725);
      expect(amount).toBe(roundMoney(unitPrice * qty));
    }
  });
});
