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
 * @param codes - Every code Zoho carries for this wine, with its bottles
 * @param packFromInvoice - Pack read from the invoice text, when stated
 * @returns The implied LWIN-18, or null when the codes do not agree
 */
const deriveLwinFromCodes = (
  codes: CodeUse[],
  packFromInvoice: number | null,
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

  // Every code must describe the same wine in the same bottle. Where they do
  // not, this is two wines sharing a SKU — a different problem, and not one to
  // resolve by arithmetic.
  const agree = parsed.every(
    (entry) =>
      entry.lwin7 === first.lwin7 &&
      entry.vintage === first.vintage &&
      entry.size === first.size,
  );

  if (!agree) return null;

  // A case holds somewhere between one and twenty-four bottles. Anything else
  // in those two digits is a slip, and the commonest is a doubled first digit.
  const plausible = parsed
    .map((entry) => entry.pack)
    .filter((pack) => pack >= 1 && pack <= 24);

  const pack = packFromInvoice ?? plausible[0] ?? null;

  if (!pack) return null;

  const stem = `${first.lwin7}-${first.vintage}`;

  return {
    lwin18: `${stem}-${String(pack).padStart(2, '0')}-${first.size}`,
    reason: packFromInvoice
      ? `Every Zoho code reads ${stem}-…-${first.size}, and the invoice states ${packFromInvoice} to a case`
      : `Every Zoho code reads ${stem}-…-${first.size}, and ${pack} is the only plausible pack among them`,
    fromCodes: parsed.map((entry) => entry.code),
    bottles: parsed.reduce((total, entry) => total + entry.bottles, 0),
  };
};

export default deriveLwinFromCodes;
