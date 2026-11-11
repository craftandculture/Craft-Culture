import { describe, expect, it } from 'vitest';

import hasPagedPastCutoff from './hasPagedPastCutoff';

const cutoff = new Date('2026-10-12T00:00:00Z');
const at = (time: string) => ({ last_modified_time: time });

describe('hasPagedPastCutoff', () => {
  it('stops once a newest-first page ends before the cutoff', () => {
    expect(
      hasPagedPastCutoff(
        [at('2026-11-10T09:00:00+0000'), at('2026-10-20T09:00:00+0000'), at('2026-09-01T09:00:00+0000')],
        cutoff,
      ),
    ).toBe(true);
  });

  it('keeps paging while the oldest on the page is still recent', () => {
    expect(
      hasPagedPastCutoff([at('2026-11-10T09:00:00+0000'), at('2026-10-12T00:00:00+0000')], cutoff),
    ).toBe(false);
  });

  it('keeps paging when the page is not in newest-first order (sort ignored)', () => {
    expect(
      hasPagedPastCutoff([at('2026-09-01T09:00:00+0000'), at('2026-11-10T09:00:00+0000'), at('2026-08-01T09:00:00+0000')], cutoff),
    ).toBe(false);
  });

  it('keeps paging on an empty page or a time it cannot read', () => {
    expect(hasPagedPastCutoff([], cutoff)).toBe(false);
    expect(hasPagedPastCutoff([at('2026-11-10T09:00:00+0000'), at('not a date')], cutoff)).toBe(false);
    expect(hasPagedPastCutoff([at('2026-11-10T09:00:00+0000'), {}], cutoff)).toBe(false);
  });
});
