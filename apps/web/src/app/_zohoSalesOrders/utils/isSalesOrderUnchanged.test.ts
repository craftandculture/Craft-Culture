import { describe, expect, it } from 'vitest';

import isSalesOrderUnchanged from './isSalesOrderUnchanged';

const stored = {
  zohoStatus: 'open',
  zohoLastModifiedTime: new Date('2026-11-01T10:00:00Z'),
};

describe('isSalesOrderUnchanged', () => {
  it('is unchanged when status and last-modified time both match', () => {
    expect(
      isSalesOrderUnchanged({
        stored,
        zohoOrder: { status: 'open', last_modified_time: '2026-11-01T14:00:00+0400' },
      }),
    ).toBe(true);
  });

  it('is changed when Zoho reports a newer time', () => {
    expect(
      isSalesOrderUnchanged({
        stored,
        zohoOrder: { status: 'open', last_modified_time: '2026-11-01T14:00:01+0400' },
      }),
    ).toBe(false);
  });

  it('is changed when only the status moved (invoiced without a time bump)', () => {
    expect(
      isSalesOrderUnchanged({
        stored,
        zohoOrder: { status: 'invoiced', last_modified_time: '2026-11-01T10:00:00Z' },
      }),
    ).toBe(false);
  });

  it('is changed when forced, nothing stored, or no stored time', () => {
    const zohoOrder = { status: 'open', last_modified_time: '2026-11-01T10:00:00Z' };
    expect(isSalesOrderUnchanged({ stored, zohoOrder, force: true })).toBe(false);
    expect(isSalesOrderUnchanged({ stored: undefined, zohoOrder })).toBe(false);
    expect(
      isSalesOrderUnchanged({ stored: { zohoStatus: 'open', zohoLastModifiedTime: null }, zohoOrder }),
    ).toBe(false);
    expect(
      isSalesOrderUnchanged({
        stored: { zohoStatus: null, zohoLastModifiedTime: stored.zohoLastModifiedTime },
        zohoOrder,
      }),
    ).toBe(false);
  });
});
