import itemBottles from './itemBottles';
import wineGroupKey from './wineGroupKey';
import type { GroupableLine } from './wineGroupKey';

export interface BilledLine extends GroupableLine {
  id: string;
  cases: number;
  bottlesPerCase: number | null;
  totalBottles: number | null;
  sourceTotal: number | null;
  sourceUnitPrice: number | null;
}

export interface BilledBottleGap {
  /** Every line of the wine, in the order given */
  itemIds: string[];
  /** Bottles the document billed for the wine: its total ÷ its price */
  billed: number;
  /** Bottles the lines hold now, across every pack size */
  onLines: number;
}

/**
 * Wines whose lines no longer hold the bottles the document billed
 *
 * A line keeps what the supplier's document said — its total and its price
 * per bottle — so the bottles billed are total ÷ price, whatever has been
 * typed into cases and packs since. Checked per wine rather than per line,
 * because "3x6 + 1x3" is one billed row spread over two lines: each line alone
 * disagrees with the document, the pair agrees with it.
 *
 * A line added by hand has no billed total and adds bottles only, which is
 * the point: Cyprien Arlaud billed 45 and entered as 1 × 3 plus 6 × 6 is 39,
 * and that is the gap to show. A wine with no billed figures is not checked.
 *
 * @param lines - The shipment's lines
 * @returns One entry per wine that disagrees, keyed by wine
 */
const findBilledBottleGaps = (lines: BilledLine[]) => {
  const groups = new Map<string, { itemIds: string[]; billed: number; hasBilled: boolean; onLines: number }>();

  for (const line of lines) {
    const key = wineGroupKey(line);
    const group = groups.get(key) ?? { itemIds: [], billed: 0, hasBilled: false, onLines: 0 };

    group.itemIds.push(line.id);
    group.onLines += itemBottles(line);

    if (line.sourceTotal && line.sourceUnitPrice && line.sourceUnitPrice > 0) {
      group.billed += line.sourceTotal / line.sourceUnitPrice;
      group.hasBilled = true;
    }

    groups.set(key, group);
  }

  const gaps = new Map<string, BilledBottleGap>();

  for (const [key, group] of groups) {
    const billed = Math.round(group.billed);

    if (group.hasBilled && billed !== group.onLines) {
      gaps.set(key, { itemIds: group.itemIds, billed, onLines: group.onLines });
    }
  }

  return gaps;
};

export default findBilledBottleGaps;
