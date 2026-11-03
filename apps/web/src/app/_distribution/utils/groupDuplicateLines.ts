import { isLwin18 } from './canonicalWineCode';
import scoreWineMatch from './scoreWineMatch';

export interface LineCode {
  /** wineKey of the code */
  key: string;
  /** The code as held, e.g. 3051757-2019-06-00750 or W28500124 */
  code: string;
  name: string;
  outBottles: number;
  soldBottles: number;
}

export interface DuplicateLineGroup {
  /** The line to keep: a real LWIN18, with the most history */
  main: LineCode;
  duplicates: LineCode[];
}

/** Names this close, in the same vintage, are one wine */
const SAME_WINE = 0.6;

const VINTAGE = /\b(19|20)\d{2}\b/;

const vintageOf = (line: LineCode) => {
  const fromCode = /^\d{7}-(\d{4})-/.exec(line.code)?.[1];

  return fromCode && fromCode !== '0000'
    ? fromCode
    : (VINTAGE.exec(line.name)?.[0] ?? null);
};

/**
 * Find wines that sit on more than one consignment line under different codes
 *
 * Sales land on one code and the invoice on another, which is where the
 * bottles with "no invoice left" and the negative sold figures come from. Two
 * codes are one wine when their names match closely and their vintages agree
 * (or one does not say). The line kept is the one with a real LWIN18, then
 * the most bottles invoiced, so the least moves.
 *
 * Proposes only; nothing is merged until a person presses the button.
 *
 * @example
 *   groupDuplicateLines(lines)[0];
 *   // { main: { code: '3051757-2019-06-00750', … }, duplicates: [{ code: 'W28500124', … }] }
 *
 * @param lines - Each code at the outlet with its name and bottles
 * @returns Groups of codes that are one wine
 */
const groupDuplicateLines = (lines: LineCode[]) => {
  const ordered = [...lines].sort(
    (a, b) =>
      Number(isLwin18(b.code)) - Number(isLwin18(a.code)) ||
      b.outBottles - a.outBottles ||
      b.soldBottles - a.soldBottles,
  );
  const taken = new Set<string>();
  const groups: DuplicateLineGroup[] = [];

  for (const main of ordered) {
    if (taken.has(main.key)) continue;

    const vintage = vintageOf(main);
    const duplicates = ordered.filter((other) => {
      if (other.key === main.key || taken.has(other.key)) return false;

      const otherVintage = vintageOf(other);

      if (vintage && otherVintage && vintage !== otherVintage) return false;

      return scoreWineMatch(main.name, other.name).score >= SAME_WINE;
    });

    if (duplicates.length === 0) continue;

    taken.add(main.key);

    for (const duplicate of duplicates) taken.add(duplicate.key);

    groups.push({ main, duplicates });
  }

  return groups;
};

export default groupDuplicateLines;
