import { describe, expect, it } from 'vitest';

import chooseLiveBay, { type LiveBayStock } from './chooseLiveBay';

const row = (overrides: Partial<LiveBayStock>): LiveBayStock => ({
  stockId: 'stock',
  locationId: 'bay',
  locationCode: 'BAY',
  storageMethod: 'shelf',
  caseConfig: 6,
  bottleSize: '75cl',
  quantityCases: 0,
  availableCases: 0,
  openBottles: 0,
  heldForThisOrder: 0,
  ...overrides,
});

/**
 * Written from PL-2026-0134: Les Fiefs de Lagrange 2022, the last of fifteen
 * subscription-box picks. The 6-pack bay D-05-00 had been emptied by the
 * earlier lists; nine bottles were still at C-01-00.
 */
describe('chooseLiveBay', () => {
  const bottleLine = {
    suggestedLocationId: 'd-05',
    quantityBottles: 1,
    quantityCases: 1,
    linePack: 6,
  };

  it('moves an emptied bay to the bay that still holds the wine', () => {
    const result = chooseLiveBay(bottleLine, [
      row({ stockId: 'd6', locationId: 'd-05', locationCode: 'D-05-00' }),
      row({
        stockId: 'c1',
        locationId: 'c-01',
        locationCode: 'C-01-00',
        caseConfig: 1,
        quantityCases: 9,
        availableCases: 9,
      }),
    ]);

    expect(result?.locationCode).toBe('C-01-00');
  });

  it('keeps the stored bay while it can still cover the line', () => {
    const result = chooseLiveBay(bottleLine, [
      row({
        locationId: 'd-05',
        quantityCases: 1,
        availableCases: 1,
      }),
      row({
        locationId: 'c-01',
        caseConfig: 1,
        quantityCases: 9,
        availableCases: 9,
      }),
    ]);

    expect(result).toBeNull();
  });

  it('uses up the 6-packs before opening the 12s', () => {
    const result = chooseLiveBay({ ...bottleLine, suggestedLocationId: null }, [
      row({
        locationId: 'big',
        locationCode: 'TWELVES',
        caseConfig: 12,
        quantityCases: 4,
        availableCases: 4,
      }),
      row({
        locationId: 'small',
        locationCode: 'SIXES',
        caseConfig: 6,
        quantityCases: 1,
        availableCases: 1,
      }),
    ]);

    expect(result?.locationCode).toBe('SIXES');
  });

  it('takes loose bottles before cracking any sealed case', () => {
    const result = chooseLiveBay(
      { ...bottleLine, suggestedLocationId: null, quantityBottles: 2 },
      [
        row({
          locationId: 'sixes',
          locationCode: 'SIXES',
          quantityCases: 3,
          availableCases: 3,
        }),
        row({
          locationId: 'scraps',
          locationCode: 'SCRAPS',
          caseConfig: 12,
          openBottles: 3,
        }),
      ],
    );

    expect(result?.locationCode).toBe('SCRAPS');
  });

  it('does not count cases reserved for another order', () => {
    const result = chooseLiveBay({ ...bottleLine, suggestedLocationId: null }, [
      row({
        locationId: 'held',
        locationCode: 'HELD',
        quantityCases: 2,
        availableCases: 0,
      }),
      row({
        locationId: 'free',
        locationCode: 'FREE',
        caseConfig: 12,
        quantityCases: 1,
        availableCases: 1,
      }),
    ]);

    expect(result?.locationCode).toBe('FREE');
  });

  it('sends a whole-case line only to its own pack', () => {
    const result = chooseLiveBay(
      {
        suggestedLocationId: 'd-05',
        quantityBottles: null,
        quantityCases: 1,
        linePack: 6,
      },
      [
        row({ locationId: 'd-05' }),
        row({
          locationId: 'twelves',
          locationCode: 'TWELVES',
          caseConfig: 12,
          quantityCases: 5,
          availableCases: 5,
        }),
        row({
          locationId: 'sixes',
          locationCode: 'SIXES',
          quantityCases: 2,
          availableCases: 2,
        }),
      ],
    );

    expect(result?.locationCode).toBe('SIXES');
  });

  it('prefers a shelf to a pallet', () => {
    const result = chooseLiveBay({ ...bottleLine, suggestedLocationId: null }, [
      row({
        locationId: 'pallet',
        locationCode: 'PALLET',
        storageMethod: 'pallet',
        caseConfig: 1,
        quantityCases: 2,
        availableCases: 2,
      }),
      row({
        locationId: 'shelf',
        locationCode: 'SHELF',
        caseConfig: 12,
        quantityCases: 1,
        availableCases: 1,
      }),
    ]);

    expect(result?.locationCode).toBe('SHELF');
  });
});
