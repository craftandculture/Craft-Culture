import { describe, expect, it } from 'vitest';

import resolvePricingMargins from './resolvePricingMargins';
import type { PricingBand } from './resolvePricingMargins';

/** The house bands chosen on 27 Aug 2026. */
const HOUSE_BANDS: PricingBand[] = [
  { ownerId: null, minLandedPerBottle: 0, maxLandedPerBottle: 50, b2bMarginPct: 30, pcMarginPct: 45 },
  { ownerId: null, minLandedPerBottle: 50, maxLandedPerBottle: 200, b2bMarginPct: 20, pcMarginPct: 35 },
  { ownerId: null, minLandedPerBottle: 200, maxLandedPerBottle: 500, b2bMarginPct: 14, pcMarginPct: 25 },
  { ownerId: null, minLandedPerBottle: 500, maxLandedPerBottle: null, b2bMarginPct: 10, pcMarginPct: 18 },
];

describe('resolvePricingMargins', () => {
  it('prices a cheap wine and a fine wine differently', () => {
    const cheap = resolvePricingMargins({
      landedPerBottle: 20,
      bands: HOUSE_BANDS,
    });
    const fine = resolvePricingMargins({
      landedPerBottle: 692.95, // Château Margaux 2012, from the pricing manager
      bands: HOUSE_BANDS,
    });

    expect(cheap.b2bPct).toBe(30);
    expect(cheap.pcPct).toBe(45);
    expect(fine.b2bPct).toBe(10);
    expect(fine.pcPct).toBe(18);
  });

  it('puts a band boundary in the lower band, not both', () => {
    const at50 = resolvePricingMargins({ landedPerBottle: 50, bands: HOUSE_BANDS });
    const justUnder = resolvePricingMargins({
      landedPerBottle: 49.99,
      bands: HOUSE_BANDS,
    });

    expect(at50.b2bPct).toBe(20);
    expect(justUnder.b2bPct).toBe(30);
  });

  it('builds each price as a margin over landed, not stacked', () => {
    const { b2bPct, pcPct, priceFor } = resolvePricingMargins({
      landedPerBottle: 64.17, // Chateau Kirwan 2010
      bands: HOUSE_BANDS,
    });

    // B2B at 20%: 64.17 / 0.8 = 80.21. PC at 35%: 64.17 / 0.65 = 98.72.
    expect(priceFor(b2bPct)).toBeCloseTo(80.21, 2);
    expect(priceFor(pcPct)).toBeCloseTo(98.72, 2);
    // Stacking would have given 80.21 / 0.65 = 123.4 — the old behaviour.
    expect(priceFor(pcPct)).toBeLessThan(120);
  });

  it('lets a per-line override beat the band, per book', () => {
    const result = resolvePricingMargins({
      landedPerBottle: 64.17,
      lineB2bPct: 8,
      bands: HOUSE_BANDS,
    });

    expect(result.b2bPct).toBe(8);
    expect(result.b2bSource).toBe('line');
    // PC untouched by the B2B override.
    expect(result.pcPct).toBe(35);
    expect(result.pcSource).toBe('house-band');
  });

  it("prefers an owner's own band over the house band", () => {
    const result = resolvePricingMargins({
      landedPerBottle: 64.17,
      ownerId: 'owner-1',
      bands: [
        ...HOUSE_BANDS,
        {
          ownerId: 'owner-1',
          minLandedPerBottle: 50,
          maxLandedPerBottle: 200,
          b2bMarginPct: 12,
          pcMarginPct: 22,
        },
      ],
    });

    expect(result.b2bPct).toBe(12);
    expect(result.b2bSource).toBe('owner-band');
  });

  it('prefers the narrower band when two overlap', () => {
    const result = resolvePricingMargins({
      landedPerBottle: 300,
      bands: [
        { ownerId: null, minLandedPerBottle: 0, maxLandedPerBottle: null, b2bMarginPct: 25, pcMarginPct: 40 },
        { ownerId: null, minLandedPerBottle: 200, maxLandedPerBottle: 500, b2bMarginPct: 14, pcMarginPct: 25 },
      ],
    });

    expect(result.b2bPct).toBe(14);
  });

  it("falls back to the owner's flat rate, then to 10%", () => {
    const withOwner = resolvePricingMargins({
      landedPerBottle: 64.17,
      ownerB2bPct: 15,
      ownerPcPct: 28,
      bands: [],
    });
    expect(withOwner.b2bPct).toBe(15);
    expect(withOwner.b2bSource).toBe('owner');

    const bare = resolvePricingMargins({ landedPerBottle: 64.17, bands: [] });
    expect(bare.b2bPct).toBe(10);
    expect(bare.b2bSource).toBe('default');
  });

  it('ignores a margin of 100% or more rather than dividing by zero', () => {
    const result = resolvePricingMargins({
      landedPerBottle: 64.17,
      lineB2bPct: 100,
      bands: HOUSE_BANDS,
    });

    expect(result.b2bPct).toBe(20);
    expect(result.b2bSource).toBe('house-band');
    expect(Number.isFinite(result.priceFor(result.b2bPct))).toBe(true);
  });
});
