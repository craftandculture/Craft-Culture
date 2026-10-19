import { describe, expect, it } from 'vitest';

import earliestDeliveryDate from './earliestDeliveryDate';

describe('earliestDeliveryDate', () => {
  it('counts five working days from a Monday', () => {
    // Monday 19 October 2026, noon in Dubai
    expect(earliestDeliveryDate(new Date('2026-10-19T08:00:00Z'))).toBe('2026-10-26');
  });

  it('skips the weekend when asked on a Friday', () => {
    // Friday 23 October 2026
    expect(earliestDeliveryDate(new Date('2026-10-23T08:00:00Z'))).toBe('2026-10-30');
  });

  it("uses Dubai's date late in the UTC evening", () => {
    // 21:00 UTC Sunday is 01:00 Monday in Dubai
    expect(earliestDeliveryDate(new Date('2026-10-18T21:00:00Z'))).toBe('2026-10-26');
  });
});
