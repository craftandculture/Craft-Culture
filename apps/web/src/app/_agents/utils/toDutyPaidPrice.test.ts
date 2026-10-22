import { describe, expect, it } from 'vitest';

import toDutyPaidPrice from './toDutyPaidPrice';

describe('toDutyPaidPrice', () => {
  it('adds 15% to a duty-free price', () => {
    expect(toDutyPaidPrice(200)).toBe(230);
  });

  it('rounds to 2 decimals', () => {
    expect(toDutyPaidPrice(99.99)).toBe(114.99);
  });

  it('keeps zero at zero', () => {
    expect(toDutyPaidPrice(0)).toBe(0);
  });
});
