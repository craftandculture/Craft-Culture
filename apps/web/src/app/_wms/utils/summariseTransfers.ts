import displayWineName from './displayWineName';

export interface TransferMovement {
  lwin18: string;
  productName: string;
  quantityCases: number;
  quantityBottles: number | null;
  fromOwnerId: string | null;
  toOwnerId: string | null;
}

export interface TransferLine {
  direction: 'in' | 'out';
  name: string;
  lwin18: string;
  cases: number;
  bottles: number;
  /** What happened, in this owner's words, never naming the other side */
  what: string;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** A transfer's size as the owner counts it: bottles for singles, else cases */
export const describeQuantity = (line: Pick<TransferLine, 'lwin18' | 'cases' | 'bottles'>) => {
  const pack = Number(line.lwin18.split('-')[2]) || 0;
  return pack === 1 ? plural(line.bottles, 'bottle') : `${plural(line.cases, 'case')} · ${plural(line.bottles, 'bottle')}`;
};

/**
 * One owner's ownership changes over a day, a line per wine and direction
 *
 * Worded as their stock activity feed words them (see getStockActivity): a
 * trade partner is never told who the other side was, and Craft & Culture
 * buying wine reads as a sale to C&C. A wine moved in and out on the same day
 * keeps both lines, so the summary agrees with the feed.
 *
 * @example
 *   summariseTransfers(movements, cultWinesId, { ccIds, isCollector: false });
 *   // [{ direction: 'out', what: 'Transferred to another owner', cases: 2, ... }]
 *
 * @param movements - The day's ownership_transfer movements
 * @param ownerId - Whose summary this is
 * @param options.ccIds - Craft & Culture's own owner records
 * @param options.isCollector - A Private Cellar member
 * @returns The lines, wines received first
 */
const summariseTransfers = (
  movements: TransferMovement[],
  ownerId: string,
  { ccIds, isCollector }: { ccIds: Set<string>; isCollector: boolean },
) => {
  const lines = new Map<string, TransferLine>();

  for (const movement of movements) {
    if (movement.fromOwnerId === movement.toOwnerId) continue;
    const direction = movement.toOwnerId === ownerId ? 'in' : movement.fromOwnerId === ownerId ? 'out' : null;
    if (!direction) continue;

    const what =
      direction === 'in'
        ? isCollector
          ? 'Added to your cellar'
          : movement.fromOwnerId && ccIds.has(movement.fromOwnerId)
            ? 'Transferred to you by Craft & Culture'
            : 'Transferred to you'
        : movement.toOwnerId && ccIds.has(movement.toOwnerId)
          ? 'Sold to Craft & Culture'
          : isCollector
            ? 'Transferred from your cellar'
            : 'Transferred to another owner';

    const pack = Number(movement.lwin18.split('-')[2]) || 1;
    const cases = Math.abs(movement.quantityCases);
    const bottles = Math.abs(movement.quantityBottles ?? cases * pack);
    const key = `${direction}|${movement.lwin18}|${what}`;
    const seen = lines.get(key);

    lines.set(
      key,
      seen
        ? { ...seen, cases: seen.cases + cases, bottles: seen.bottles + bottles }
        : {
            direction,
            name: displayWineName(movement.productName, { keepVintage: true }),
            lwin18: movement.lwin18,
            cases,
            bottles,
            what,
          },
    );
  }

  return [...lines.values()].sort((a, b) => (a.direction === b.direction ? a.name.localeCompare(b.name) : a.direction === 'in' ? -1 : 1));
};

export default summariseTransfers;
