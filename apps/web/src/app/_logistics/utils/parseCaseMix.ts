export interface CaseMixPart {
  cases: number;
  bottlesPerCase: number;
}

/**
 * Read a mixed-pack breakdown such as "3x6 + 1x3"
 *
 * Vinlock's packing list prints one row per wine and puts the boxes in the
 * "Bts per cases" column: "6" for a plain row, "7x6 + 1x3" when the wine
 * travels as seven 6-packs and a 3-pack. Read as one pack, that row became
 * 7 cases of 3, which is how de Montille arrived as 7 × 3 instead of
 * 3 × 6 + 1 × 3. A breakdown is only returned when it names two or more
 * parts; a single "6" is an ordinary pack and is left to the caller.
 *
 * @example
 *   parseCaseMix('7x6 + 1x3'); // [{ cases: 7, bottlesPerCase: 6 }, { cases: 1, bottlesPerCase: 3 }]
 *   parseCaseMix('6'); // null
 *
 * @param text - The pack text as printed
 * @returns Each part, or null if the text is not a multi-part breakdown
 */
const parseCaseMix = (text: string | null | undefined) => {
  if (!text) return null;

  const terms = text.split('+').map((term) => term.trim()).filter(Boolean);

  if (terms.length < 2) return null;

  const parts: CaseMixPart[] = [];

  for (const term of terms) {
    const match = /^(\d{1,3})\s*[x×*]\s*(\d{1,2})$/i.exec(term);

    if (!match) return null;

    const cases = Number(match[1]);
    const bottlesPerCase = Number(match[2]);

    if (cases < 1 || bottlesPerCase < 1 || bottlesPerCase > 24) return null;

    parts.push({ cases, bottlesPerCase });
  }

  return parts;
};

export default parseCaseMix;
