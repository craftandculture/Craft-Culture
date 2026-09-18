import { describe, expect, it, vi } from 'vitest';

import writeSnapshot from './writeSnapshot';
import type { ParsedCityDrinksStock } from '../utils/parseCityDrinksStock';

const parsed: ParsedCityDrinksStock = {
  takenAt: new Date('2026-09-18T02:00:05Z'),
  rows: [
    {
      outletCode: 'CDR1',
      ourCode: 'W1',
      productName: 'A wine',
      regime: 'consigned',
      bottlesOnHand: 6,
      bottlesInTransit: 0,
      soldLast30d: 1,
      soldLast90d: 2,
    },
  ],
  unmatched: [],
  counts: {
    total: 1,
    consigned: 1,
    bought: 0,
    excluded: 0,
    consignedBottles: 6,
  },
};

/**
 * A fake postgres client that records what it was bound.
 *
 * Calling it as a template records the interpolated values; calling it as a
 * function is the driver's own multi-row helper, which takes the rows.
 */
const fakeSql = () => {
  const bound: unknown[] = [];
  const rowsPassed: unknown[] = [];

  const sql = ((...args: unknown[]) => {
    if (Array.isArray(args[0]) && 'raw' in (args[0] as object)) {
      bound.push(...args.slice(1));

      return Promise.resolve([]);
    }

    rowsPassed.push(args[0]);

    return { __rows: args[0] };
  }) as never;

  return { sql, bound, rowsPassed };
};

describe('writeSnapshot', () => {
  /*
    A Date reaches the driver as an object it will not serialise, and it fails
    at the write — after the entire feed has been fetched. This has regressed
    once already.
  */
  it('binds the instant as a string, never a Date', async () => {
    const { sql, bound, rowsPassed } = fakeSql();

    await writeSnapshot(sql, 'outlet-1', parsed);

    expect(bound.some((value) => value instanceof Date)).toBe(false);
    expect(bound).toContain('2026-09-18T02:00:05.000Z');

    const rows = rowsPassed[0] as { taken_at: unknown }[];

    expect(rows[0]!.taken_at).toBe('2026-09-18T02:00:05.000Z');
    expect(rows[0]!.taken_at).not.toBeInstanceOf(Date);
  });

  it('deletes and inserts the same instant, so a re-pull replaces', async () => {
    const { sql, bound, rowsPassed } = fakeSql();

    await writeSnapshot(sql, 'outlet-1', parsed);

    const rows = rowsPassed[0] as { taken_at: unknown }[];

    expect(bound).toContain(rows[0]!.taken_at);
  });

  it('writes nothing when the feed is empty, rather than an empty insert', async () => {
    const { sql, rowsPassed } = fakeSql();

    await writeSnapshot(sql, 'outlet-1', { ...parsed, rows: [] });

    expect(rowsPassed).toHaveLength(0);
  });
});
