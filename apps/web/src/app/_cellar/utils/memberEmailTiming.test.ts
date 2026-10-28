import { describe, expect, it } from 'vitest';

import { gulfDay, nextMergeSlot, nextMorning, outsideQuietHours } from './memberEmailTiming';

describe('outsideQuietHours', () => {
  it('leaves a daytime email alone', () => {
    // 10:00 Gulf
    const at = new Date('2026-10-26T06:00:00Z');
    expect(outsideQuietHours(at)).toEqual(at);
  });

  it('holds a late-evening email until 08:00 the next day', () => {
    // 22:30 Gulf Monday
    expect(outsideQuietHours(new Date('2026-10-26T18:30:00Z'))).toEqual(new Date('2026-10-27T04:00:00Z'));
  });

  it('holds an early-morning email until 08:00 the same day', () => {
    // 06:15 Gulf
    expect(outsideQuietHours(new Date('2026-10-27T02:15:00Z'))).toEqual(new Date('2026-10-27T04:00:00Z'));
  });
});

describe('nextMergeSlot', () => {
  it('sends a morning event at noon', () => {
    // 09:40 Gulf
    expect(nextMergeSlot(new Date('2026-10-26T05:40:00Z'))).toEqual(new Date('2026-10-26T08:00:00Z'));
  });

  it('sends an afternoon event at 17:00', () => {
    // 13:10 Gulf
    expect(nextMergeSlot(new Date('2026-10-26T09:10:00Z'))).toEqual(new Date('2026-10-26T13:00:00Z'));
  });

  it('sends an evening event at noon the next day', () => {
    // 18:05 Gulf
    expect(nextMergeSlot(new Date('2026-10-26T14:05:00Z'))).toEqual(new Date('2026-10-27T08:00:00Z'));
  });
});

describe('nextMorning and gulfDay', () => {
  it('moves to 08:00 Gulf the next day', () => {
    expect(nextMorning(new Date('2026-10-26T13:00:00Z'))).toEqual(new Date('2026-10-27T04:00:00Z'));
  });

  it("uses the Gulf date late in the UTC evening", () => {
    // 21:00 UTC Sunday is 01:00 Monday in the Gulf
    expect(gulfDay(new Date('2026-10-25T21:00:00Z'))).toBe('2026-10-26');
  });
});
