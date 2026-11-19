import describeSize from './describeSize';
import type { WarehouseUpdateLine } from '../types';

/**
 * A pick list's lines as the email lists them: one line per wine, cases and
 * loose bottles added together, with the totals
 *
 * @example
 *   summarisePickLines([{ name: 'Petrus 2015', cases: 2, bottles: null }]);
 *   // { lines: [{ name: 'Petrus 2015', quantity: '2 cases' }], cases: 2, bottles: 0 }
 *
 * @param items - The pick list items; bottles set means a split-case pick
 * @returns The lines, total cases and total loose bottles
 */
const summarisePickLines = (items: { name: string; cases: number; bottles: number | null }[]) => {
  const byName = new Map<string, { cases: number; bottles: number }>();
  for (const item of items) {
    const entry = byName.get(item.name) ?? { cases: 0, bottles: 0 };
    if (item.bottles) entry.bottles += item.bottles;
    else entry.cases += item.cases;
    byName.set(item.name, entry);
  }

  const lines: WarehouseUpdateLine[] = [...byName.entries()].map(([name, qty]) => ({
    name,
    quantity: describeSize(qty.cases, qty.bottles),
  }));

  return {
    lines,
    cases: [...byName.values()].reduce((sum, qty) => sum + qty.cases, 0),
    bottles: [...byName.values()].reduce((sum, qty) => sum + qty.bottles, 0),
  };
};

export default summarisePickLines;
