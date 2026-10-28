import { describe, expect, it } from 'vitest';

import parseMatchResponse from './parseMatchResponse';
import parsePriceStatsResponse from './parsePriceStatsResponse';
import parseWineInfoResponse from './parseWineInfoResponse';

describe('parseMatchResponse', () => {
  it('reads a match', () => {
    expect(
      parseMatchResponse({ lwin7: '1012781', lwin: '10127812015', display_name: 'Opus One 2015', wl_id: 'wl1' }),
    ).toEqual({ lwin7: '1012781', lwin: '10127812015', displayName: 'Opus One 2015', wlId: 'wl1' });
  });

  it('treats all-null as no match', () => {
    expect(parseMatchResponse({ lwin7: null, lwin: null, display_name: null, wl_id: null })).toBeNull();
  });

  it('takes the LWIN7 from a longer LWIN when lwin7 is missing', () => {
    expect(parseMatchResponse({ lwin: '10127812015' })?.lwin7).toBe('1012781');
  });
});

describe('parseWineInfoResponse', () => {
  it('reads the drinking window', () => {
    const info = parseWineInfoResponse({
      lwin: '1012781',
      result: { name: 'Opus One', avg_beg_drink_window: 2024.4, avg_end_drink_window: 2045 },
    });
    expect(info?.drinkFrom).toBe(2024);
    expect(info?.drinkTo).toBe(2045);
  });

  it('is null when the wine is unmapped', () => {
    expect(parseWineInfoResponse({ lwin: '1012781', result: null })).toBeNull();
  });

  it('ignores a window that is not a year', () => {
    expect(parseWineInfoResponse({ result: { avg_beg_drink_window: 0 } })?.drinkFrom).toBeNull();
  });
});

describe('parsePriceStatsResponse', () => {
  it('takes the latest snapshot', () => {
    const stats = parsePriceStatsResponse({
      results: [
        { date: '2026-09-01', median_value: 50, count: 30 },
        { date: '2026-10-20', median_value: 55.01, count: 36 },
      ],
    });
    expect(stats?.medianUsd).toBe(55.01);
    expect(stats?.count).toBe(36);
  });

  it('is null when there are no recent prices', () => {
    expect(parsePriceStatsResponse({ results: [] })).toBeNull();
  });
});
