import { describe, expect, it } from 'vitest';

import readConsignmentSubject from './readConsignmentSubject';

/**
 * INV-000294, the reference CONSIGNMENT_MIX invoice.
 *
 * Its subject is CONSIGNMENT_MIX and its items are grouped under heading rows
 * naming the owner of the lines beneath. Read per line, it settles as 11
 * bottles and $5,221 to C&C, and 4 bottles and $900 to Rare — which agrees
 * with the document's own $6,121 total and its "TOTAL CASES 9".
 *
 * Read per invoice, as it was before, the whole thing went to whoever took
 * unattributed lines and both clients were wrong.
 */
const LINES = [
  { name: 'CONSIGNMENT_CC', quantity: 0, pack: 0, amount: 0 },
  { name: 'Chateau Margaux 1986', quantity: 2, pack: 3, amount: 3396 },
  { name: 'Latour_1993', quantity: 2, pack: 2, amount: 1753 },
  { name: 'Pierre Girardin Chassagne-Montrachet', quantity: 1, pack: 1, amount: 72 },
  { name: 'CONSIGNMENT_RARE', quantity: 0, pack: 0, amount: 0 },
  { name: 'Bouchard Pere et Fils Vosne Romanee Reignots 2001', quantity: 4, pack: 1, amount: 900 },
];

/** The attribution the sync performs, in miniature */
const attribute = (invoiceOwner: string | null) => {
  const byOwner = new Map<string, { bottles: number; value: number }>();
  let owner = invoiceOwner;

  for (const line of LINES) {
    const heading = readConsignmentSubject(line.name, null);

    if (heading.isConsignment && !line.quantity) {
      owner = heading.ownerName ?? owner;
      continue;
    }

    if (!line.quantity) continue;

    const key = owner ?? 'unattributed';
    const held = byOwner.get(key) ?? { bottles: 0, value: 0 };

    held.bottles += line.quantity * line.pack;
    held.value += line.amount;
    byOwner.set(key, held);
  }

  return byOwner;
};

describe('a mixed consignment invoice splits by its heading rows', () => {
  const split = attribute(null);

  it('gives C&C its eleven bottles', () => {
    expect(split.get('C&C')).toEqual({ bottles: 11, value: 5221 });
  });

  it('gives Rare its four', () => {
    expect(split.get('Rare')).toEqual({ bottles: 4, value: 900 });
  });

  it('leaves nothing unattributed', () => {
    expect(split.get('unattributed')).toBeUndefined();
  });

  it('adds up to what the document states', () => {
    const totals = [...split.values()];

    expect(totals.reduce((sum, o) => sum + o.value, 0)).toBe(6121);
    expect(totals.reduce((sum, o) => sum + o.bottles, 0)).toBe(15);
  });

  it('does not treat a heading as a wine', () => {
    expect([...split.keys()]).not.toContain('unattributed');
    expect(split.size).toBe(2);
  });
});
