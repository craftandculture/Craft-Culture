import { describe, expect, it } from 'vitest';

import planGiveBack from './planGiveBack';

/**
 * The 5 Nov ghost rows: one case received on SHP-2026-0032, held for a City
 * Drinks order, picked on PL-2026-0166 / PL-2026-0170, and then given back to
 * available by a release that had claimed the same hold. Shelf 0, available 1,
 * and the price lists offered it.
 */

interface Row {
  quantityCases: number;
  reservedCases: number;
  availableCases: number;
}

// What a release used to write: reserved floored at 0, available + hold
const uncappedGiveBack = (row: Row, cases: number): Row => ({
  quantityCases: row.quantityCases,
  reservedCases: Math.max(row.reservedCases - cases, 0),
  availableCases: row.availableCases + cases,
});

// convertReservationToPick on a held case: off the shelf and out of reserved
const pickHeld = (row: Row, cases: number): Row => ({
  quantityCases: row.quantityCases - cases,
  reservedCases: row.reservedCases - cases,
  availableCases: row.availableCases,
});

const received: Row = { quantityCases: 1, reservedCases: 0, availableCases: 1 };
const held: Row = { quantityCases: 1, reservedCases: 1, availableCases: 0 };

describe('planGiveBack', () => {
  it('reproduces the ghost: a hold picked and then released offers an empty shelf', () => {
    // The pick converts the hold while a release has already claimed it
    const afterPick = pickHeld(held, 1);
    expect(afterPick).toEqual({ quantityCases: 0, reservedCases: 0, availableCases: 0 });

    const ghost = uncappedGiveBack(afterPick, 1);
    expect(ghost.quantityCases).toBe(0);
    expect(ghost.availableCases).toBe(1);
  });

  it('never gives back more than the shelf less what is still held', () => {
    const afterPick = pickHeld(held, 1);
    expect(planGiveBack(afterPick, 1)).toEqual({ quantityCases: 0, reservedCases: 0, availableCases: 0 });
  });

  it('gives an ordinary released hold back in full', () => {
    expect(planGiveBack(held, 1)).toEqual(received);
    expect(
      planGiveBack({ quantityCases: 5, reservedCases: 3, availableCases: 2 }, 2),
    ).toEqual({ quantityCases: 5, reservedCases: 1, availableCases: 4 });
  });

  it('keeps the other holds on the row held', () => {
    // Two orders hold a case each; one lets go
    expect(
      planGiveBack({ quantityCases: 2, reservedCases: 2, availableCases: 0 }, 1),
    ).toEqual({ quantityCases: 2, reservedCases: 1, availableCases: 1 });
  });

  it('caps a half-picked hold given back at its old size', () => {
    // A 2-case hold shrunk to 1 by a pick, released as if still 2
    const shrunk = { quantityCases: 1, reservedCases: 1, availableCases: 0 };
    expect(planGiveBack(shrunk, 2)).toEqual({ quantityCases: 1, reservedCases: 0, availableCases: 1 });
  });

  it('pulls an already overstated row back down rather than adding to it', () => {
    expect(
      planGiveBack({ quantityCases: 1, reservedCases: 1, availableCases: 1 }, 1),
    ).toEqual({ quantityCases: 1, reservedCases: 0, availableCases: 1 });
  });
});
