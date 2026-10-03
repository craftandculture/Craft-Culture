import { describe, expect, it } from 'vitest';

import type { DailyOutletSales } from './buildDailySales';
import formatDailySalesForSlack from './formatDailySalesForSlack';

const sales = (lines: number): DailyOutletSales => ({
  outletId: 'x',
  outletName: 'City Drinks',
  currency: 'USD',
  latestSnapshotAt: '2026-10-03',
  notMoving: [],
  unlinked: 0,
  stockWines: [],
  check: null,
  days: [
    {
      salesDate: '2026-10-02',
      openedAt: '2026-10-02',
      closedAt: '2026-10-03',
      spanHours: 24,
      consigned: { bottles: lines, value: lines * 100 },
      bought: { bottles: 0, value: 0 },
      restocks: [],
      stock: [
        { ownerName: 'Crurated', regime: 'consigned' as const, category: 'wine' as const, bottles: 40, value: 4000, unvalued: 0 },
      ],
      lines: Array.from({ length: lines }, (_, i) => ({
        outletCode: `CDR${i}`,
        productName: `Domaine de Montille Chassagne-Montrachet 1er Cru Les Caillerets ${2000 + i}`,
        ownerName: 'Crurated',
        category: 'wine' as const,
        regime: 'consigned' as const,
        sold: 1,
        heldAfter: 3,
        value: 100,
        currency: 'USD',
      })),
    },
  ],
});

describe('formatDailySalesForSlack', () => {
  it('lists every wine, in blocks Slack will accept', () => {
    const { blocks } = formatDailySalesForSlack(sales(60));
    const texts = (blocks as { text?: { text?: string } }[])
      .map((block) => block.text?.text ?? '')
      .filter((text) => text.includes('•'));

    expect(texts.join('\n').match(/•/g)).toHaveLength(60);
    expect(texts.length).toBeGreaterThan(1);
    for (const text of texts) expect(text.length).toBeLessThanOrEqual(3000);
  });

  it('says what the outlet holds and what it is worth', () => {
    expect(JSON.stringify(formatDailySalesForSlack(sales(1)).blocks)).toContain('40 bottles · USD 4,000');
  });

  it('names a window that spans a missed pull as a range', () => {
    const data = sales(1);
    data.days[0]!.spanHours = 144;
    data.days[0]!.salesDate = '2026-09-27';

    expect(formatDailySalesForSlack(data).text).toContain('Sun 27 Sept – Fri 2 Oct');
  });
});
