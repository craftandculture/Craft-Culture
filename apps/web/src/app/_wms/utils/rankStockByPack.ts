interface RankableStock {
  caseConfig: number | null;
  availableCases?: number | null;
}

/**
 * Order candidate stock rows by how well the pack they're cased in fits the
 * pack that was ordered.
 *
 * The ordered pack and the shelved pack are allowed to differ — invoice a
 * 3-pack, hold a 6-pack and the case is broken at pick time — so a bay lookup
 * must consider every pack of the same wine. This is the preference order:
 *
 * 1. the exact ordered pack (no repack at all)
 * 2. the smallest larger pack, which can be broken down
 * 3. smaller packs, which have to be combined
 *
 * Within a rank, bays holding available stock come first and the emptiest is
 * drained before a full one.
 *
 * @example
 *   rankStockByPack([{caseConfig: 12}, {caseConfig: 6}, {caseConfig: 3}], 3);
 *   // -> [{caseConfig: 3}, {caseConfig: 6}, {caseConfig: 12}]
 *
 * @param rows - Candidate stock rows for one wine
 * @param orderedPack - Bottles per case the customer ordered
 * @returns A new array, best-fitting bay first
 */
const rankStockByPack = <T extends RankableStock>(
  rows: T[],
  orderedPack: number,
) => {
  const packOf = (row: T) =>
    row.caseConfig && row.caseConfig > 0 ? row.caseConfig : orderedPack;

  const rankOf = (row: T) => {
    const pack = packOf(row);
    if (pack === orderedPack) return 0;
    return pack > orderedPack ? 1 : 2;
  };

  return [...rows].sort((a, b) => {
    const rankDiff = rankOf(a) - rankOf(b);
    if (rankDiff !== 0) return rankDiff;

    const fitDiff =
      Math.abs(packOf(a) - orderedPack) - Math.abs(packOf(b) - orderedPack);
    if (fitDiff !== 0) return fitDiff;

    const aAvailable = a.availableCases ?? 0;
    const bAvailable = b.availableCases ?? 0;
    if (aAvailable > 0 !== bAvailable > 0) return aAvailable > 0 ? -1 : 1;

    return aAvailable - bAvailable;
  });
};

export default rankStockByPack;
