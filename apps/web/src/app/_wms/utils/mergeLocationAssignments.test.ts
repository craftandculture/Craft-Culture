import { describe, expect, it } from 'vitest';

import mergeLocationAssignments from './mergeLocationAssignments';

describe('mergeLocationAssignments', () => {
  it('books two batches into the same bay as one', () => {
    expect(
      mergeLocationAssignments([
        { locationId: 'bay-a', cases: 5 },
        { locationId: 'bay-a', cases: 7 },
      ]),
    ).toEqual([{ locationId: 'bay-a', cases: 12, isPalletized: false }]);
  });

  it('leaves a split across different bays alone, in order', () => {
    const split = [
      { locationId: 'bay-b', cases: 3 },
      { locationId: 'bay-a', cases: 4 },
    ];
    expect(mergeLocationAssignments(split)).toEqual(split);
  });

  it('keeps the bay palletised only when every batch was', () => {
    expect(
      mergeLocationAssignments([
        { locationId: 'floor-1', cases: 40, isPalletized: true },
        { locationId: 'floor-1', cases: 40, isPalletized: true },
        { locationId: 'floor-2', cases: 40, isPalletized: true },
        { locationId: 'floor-2', cases: 2 },
      ]),
    ).toEqual([
      { locationId: 'floor-1', cases: 80, isPalletized: true },
      { locationId: 'floor-2', cases: 42, isPalletized: false },
    ]);
  });

  it('does not change the caller’s array', () => {
    const input = [
      { locationId: 'bay-a', cases: 1 },
      { locationId: 'bay-a', cases: 1 },
    ];
    mergeLocationAssignments(input);
    expect(input[0]).toEqual({ locationId: 'bay-a', cases: 1 });
  });
});
