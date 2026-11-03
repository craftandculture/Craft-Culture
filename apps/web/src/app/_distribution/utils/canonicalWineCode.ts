import normalizeLwin18 from '@/app/_lwin/utils/normalizeLwin18';

import wineKey from './wineKey';

/**
 * The code a line should carry: dashed LWIN18, then any merge applied
 *
 * Codes reach us as 140688720106600750 (the dashes lost) as often as in the
 * canonical 1406887-2010-66-00750, and a wine merged into another must land on
 * the other's line. Both are settled here, once, for every reader.
 *
 * Follows a chain of merges a few steps, so folding A into B and later B into
 * C leaves A on C; a loop stops rather than spins.
 *
 * @example
 *   canonicalWineCode('305175720106200750', aliases);
 *   // '3051757-2019-06-00750'
 *
 * @param code - The code as it arrived
 * @param aliases - Folded code key → the wine it is
 * @returns The code to file the line under, and whether a merge moved it
 */
const canonicalWineCode = (
  code: string | null | undefined,
  aliases: ReadonlyMap<string, { lwin18: string }>,
) => {
  const start = normalizeLwin18(code?.trim() || null);

  if (!start) return { code: null, merged: false };

  let current = start;
  let merged = false;

  for (let step = 0; step < 5; step++) {
    const target = aliases.get(wineKey(current));

    if (!target || wineKey(target.lwin18) === wineKey(current)) break;

    current = normalizeLwin18(target.lwin18) ?? target.lwin18;
    merged = true;
  }

  return { code: current, merged };
};

/**
 * Whether a code is a LWIN18 in its canonical dashed form
 *
 * @param code - A code
 * @returns True for 7 digits, vintage, pack and size, dashed
 */
export const isLwin18 = (code: string | null | undefined) =>
  /^\d{7}-\d{4}-\d{2}-\d{5}$/.test(code ?? '');

export default canonicalWineCode;
