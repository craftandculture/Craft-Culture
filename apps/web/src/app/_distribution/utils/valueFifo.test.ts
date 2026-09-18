import { describe, expect, it } from 'vitest';

import valueFifo from './valueFifo';
import type { OutLayer } from './valueFifo';

/** Two shipments of one wine, at prices that moved between them */
const LAYERS: OutLayer[] = [
  { docDate: '2026-05-10', docRef: 'INV-100', bottles: 12, pricePerBottle: 100, currency: 'USD' },
  { docDate: '2026-07-02', docRef: 'INV-200', bottles: 12, pricePerBottle: 150, currency: 'USD' },
];

describe('valueFifo', () => {
  it('draws from the oldest invoice first', () => {
    const result = valueFifo(LAYERS, 6);

    expect(result.value).toBe(600);
    expect(result.drawnFrom).toEqual([
      { docRef: 'INV-100', bottles: 6, value: 600 },
    ]);
  });

  it('spills into the next invoice when the first runs out', () => {
    const result = valueFifo(LAYERS, 18);

    // 12 at 100, then 6 at 150
    expect(result.value).toBe(2100);
    expect(result.drawnFrom.map((d) => d.docRef)).toEqual([
      'INV-100',
      'INV-200',
    ]);
  });

  /*
    A month settled earlier has already eaten the oldest layers. Without this
    every month would value from the cheapest stock again and the owner would
    be underpaid repeatedly.
  */
  it('skips what earlier months already consumed', () => {
    const result = valueFifo(LAYERS, 6, 12);

    expect(result.value).toBe(900);
    expect(result.drawnFrom[0]!.docRef).toBe('INV-200');
  });

  it('reports a shortfall rather than inventing a price', () => {
    const result = valueFifo(LAYERS, 30);

    expect(result.bottles).toBe(24);
    expect(result.shortBottles).toBe(6);
    expect(result.value).toBe(3000);
  });

  /*
    Two invoices on one day must not value the month differently between runs —
    the same non-determinism an unordered LIMIT 1 produced elsewhere here.
  */
  it('breaks a same-day tie deterministically', () => {
    const sameDay: OutLayer[] = [
      { docDate: '2026-06-01', docRef: 'INV-002', bottles: 6, pricePerBottle: 200, currency: 'USD' },
      { docDate: '2026-06-01', docRef: 'INV-001', bottles: 6, pricePerBottle: 100, currency: 'USD' },
    ];

    expect(valueFifo(sameDay, 6).value).toBe(600);
    expect(valueFifo([...sameDay].reverse(), 6).value).toBe(600);
  });

  it('refuses to name a currency when the layers disagree', () => {
    const mixed: OutLayer[] = [
      { ...LAYERS[0]!, currency: 'USD' },
      { ...LAYERS[1]!, currency: 'AED' },
    ];

    expect(valueFifo(mixed, 6).currency).toBeNull();
  });

  it('values nothing when nothing sold', () => {
    expect(valueFifo(LAYERS, 0).value).toBe(0);
  });
});
