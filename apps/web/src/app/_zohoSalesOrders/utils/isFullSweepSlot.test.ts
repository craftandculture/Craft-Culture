import { describe, expect, it } from 'vitest';

import isFullSweepSlot from './isFullSweepSlot';

describe('isFullSweepSlot', () => {
  it('is the run in the first five minutes of the hour, UTC', () => {
    expect(isFullSweepSlot(new Date('2026-11-11T09:00:00Z'))).toBe(true);
    expect(isFullSweepSlot(new Date('2026-11-11T09:04:59Z'))).toBe(true);
    expect(isFullSweepSlot(new Date('2026-11-11T09:05:00Z'))).toBe(false);
    expect(isFullSweepSlot(new Date('2026-11-11T09:55:00Z'))).toBe(false);
  });
});
