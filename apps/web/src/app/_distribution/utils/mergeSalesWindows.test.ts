import { describe, expect, it } from 'vitest';

import type { DailySalesDay } from './buildDailySales';
import mergeSalesWindows from './mergeSalesWindows';

const line = (outletCode: string, sold: number, value: number | null, heldAfter: number) => ({
  outletCode,
  linked: value !== null,
  lwin: null,
  productName: outletCode,
  category: 'wine' as const,
  ownerName: null,
  regime: 'consigned' as const,
  sold,
  heldAfter,
  value,
  currency: value !== null ? 'USD' : null,
});

const day = (closedAt: string, spanHours: number, lines: DailySalesDay['lines']): DailySalesDay => ({
  salesDate: '2026-11-16',
  openedAt: closedAt,
  closedAt,
  spanHours,
  consigned: { bottles: lines.reduce((s, l) => s + l.sold, 0), value: lines.reduce((s, l) => s + (l.value ?? 0), 0) },
  bought: { bottles: 0, value: 0 },
  lines,
  restocks: [],
  withdrawals: [{ productName: 'Leroy', ownerName: null, bottles: 1 }],
  dropped: [],
  resumed: { wines: 0, sold: 0, since: null },
  stock: [],
});

describe('mergeSalesWindows', () => {
  it('adds a day split by a pull taken by hand, as on 16 Nov', () => {
    const morning = day('2026-11-17T03:00:00Z', 9, [line('SASS18', 2, null, 4)]);
    const evening = day('2026-11-16T20:43:00Z', 15, [line('SASS18', 1, null, 6), line('SEGLA', 3, 211, 2)]);
    const yesterday = day('2026-11-16T05:00:00Z', 24, [line('SEGLA', 9, 600, 5)]);

    const merged = mergeSalesWindows([morning, evening, yesterday]);

    expect(merged?.spanHours).toBe(24);
    expect(merged?.consigned).toEqual({ bottles: 6, value: 211 });
    expect(merged?.lines.find((l) => l.outletCode === 'SASS18')).toMatchObject({ sold: 3, value: null, heldAfter: 4 });
    expect(merged?.withdrawals).toEqual([{ productName: 'Leroy', ownerName: null, bottles: 2 }]);
    expect(merged?.closedAt).toBe('2026-11-17T03:00:00Z');
  });

  it('leaves a normal day alone', () => {
    const only = day('2026-11-17T03:00:00Z', 24, [line('A', 1, 10, 0)]);
    expect(mergeSalesWindows([only, day('2026-11-16T03:00:00Z', 24, [])])).toBe(only);
  });
});
