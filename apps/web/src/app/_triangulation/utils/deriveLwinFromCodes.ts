export interface CodeUse {
  code: string;
  bottles: number;
}

export interface DerivedLwin {
  lwin18: string;
  /** Why this is the answer, in words that can be checked against the invoice */
  reason: string;
  /** The codes it was read from */
  fromCodes: string[];
  bottles: number;
}

/** LWIN7, vintage, pack, millilitres */
const DASHED = /^(\d{7})-(\d{4})-(\d{2})-(\d{5})$/;

/**
 * Read the LWIN a wine's own Zoho codes already imply
 *
 * Zoho commonly holds the right code with one field wrong. A champagne carried
 * `2665483-1000-66-00750` on one invoice and `2665483-1000-06-00750` on
 * another: same wine, same non-vintage, same 75cl, and a pack of 66 that is
 * plainly a typed 06 — nobody sells champagne 66 to a case.
 *
 * The three fields that identify the wine agree across every code, so the only
 * question is the pack, and the invoice states that in words: "(6x75cl)".
 *
 * This is stronger evidence than any search. A name match guesses which wine
 * was meant; these codes were written against the very invoices being
 * reconciled. It is also the only source that works for a wine the warehouse
 * never received, which is exactly the set left stuck at the end.
 *
 * Where the codes disagree, the wine itself is the tiebreak. Two codes reading
 * `1243561-2020-…` and `1243561-2021-…` are one wine filed under two vintages,
 * and a SKU named "Terre Elysée 2021" says which is meant. Only a disagreement
 * the wine cannot settle is left alone.
 *
 * @param codes - Every code Zoho carries for this wine, with its bottles
 * @param packFromInvoice - Pack read from the invoice text, when stated
 * @param skuVintage - The wine's vintage, to settle codes that disagree
 * @param skuSizeMl - The wine's bottle size, likewise
 * @returns The implied LWIN-18, or null when the codes cannot be reconciled
 */
const deriveLwinFromCodes = (
  codes: CodeUse[],
  packFromInvoice: number | null,
  skuVintage?: number | null,
  skuSizeMl?: number | null,
): DerivedLwin | null => {
  const parsed = codes
    .map((entry) => {
      const match = DASHED.exec(entry.code.trim());

      return match
        ? {
            lwin7: match[1] as string,
            vintage: match[2] as string,
            pack: Number(match[3]),
            size: match[4] as string,
            bottles: entry.bottles,
            code: entry.code.trim(),
          }
        : null;
    })
    .filter((entry) => entry !== null);

  const first = parsed[0];

  if (!first) return null;

  // A different LWIN7 is a different wine, and nothing about this SKU can
  // settle which was meant. That is two wines sharing a SKU — a different
  // problem, and not one arithmetic should touch.
  if (parsed.some((entry) => entry.lwin7 !== first.lwin7)) return null;

  const settle = (
    field: 'vintage' | 'size',
    stated: string | null,
  ): string | null => {
    const values = [...new Set(parsed.map((entry) => entry[field]))];

    if (values.length === 1) return values[0] ?? null;

    // They disagree, so only the wine's own answer will do — and only if it is
    // one of the values actually in use, or this is a guess wearing a fact's
    // clothes.
    return stated && values.includes(stated) ? stated : null;
  };

  const vintage = settle(
    'vintage',
    skuVintage ? String(skuVintage).padStart(4, '0') : null,
  );
  const size = settle(
    'size',
    skuSizeMl ? String(skuSizeMl).padStart(5, '0') : null,
  );

  if (!vintage || !size) return null;

  const settledVintage = vintage !== first.vintage || size !== first.size;

  // A case holds somewhere between one and twenty-four bottles. Anything else
  // in those two digits is a slip, and the commonest is a doubled first digit.
  const plausible = parsed
    .map((entry) => entry.pack)
    .filter((pack) => pack >= 1 && pack <= 24);

  const pack = packFromInvoice ?? plausible[0] ?? null;

  if (!pack) return null;

  const stem = `${first.lwin7}-${vintage}`;
  const packSaid = packFromInvoice
    ? `the invoice states ${packFromInvoice} to a case`
    : `${pack} is the only plausible pack among them`;

  return {
    lwin18: `${stem}-${String(pack).padStart(2, '0')}-${size}`,
    reason: settledVintage
      ? `Every Zoho code is wine ${first.lwin7}, filed under more than one vintage or size; this SKU is the ${vintage.replace(/^0+/, '')} in ${Number(size)}ml, and ${packSaid}`
      : `Every Zoho code reads ${stem}-…-${size}, and ${packSaid}`,
    fromCodes: parsed.map((entry) => entry.code),
    bottles: parsed.reduce((total, entry) => total + entry.bottles, 0),
  };
};

export default deriveLwinFromCodes;
