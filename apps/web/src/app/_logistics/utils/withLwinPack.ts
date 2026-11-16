import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';

/**
 * The same wine's LWIN18 for a different pack
 *
 * A dashed LWIN18 is `wine-vintage-pack-size`, and the pack is part of the
 * stock key: three 6-packs received under a `-03-` code become stock of a
 * 3-pack that nobody can find. So a second pack size of a wine takes its own
 * code, differing only in the pack digits.
 *
 * @example
 *   withLwinPack('1063145-2022-03-00750', 6); // '1063145-2022-06-00750'
 *
 * @param lwin - The line's LWIN18, dashed or compact
 * @param bottlesPerCase - The pack the new code should state
 * @returns The re-packed code, or the input unchanged if it is not a LWIN18
 */
const withLwinPack = (lwin: string | null | undefined, bottlesPerCase: number) => {
  if (!lwin) return lwin ?? null;

  const normalized = normalizeLwin18(lwin);
  const parts = normalized ? String(normalized).split('-') : [];

  if (parts.length !== 4 || bottlesPerCase < 1 || bottlesPerCase > 99) {
    return lwin;
  }

  return [parts[0], parts[1], String(bottlesPerCase).padStart(2, '0'), parts[3]].join('-');
};

export default withLwinPack;
