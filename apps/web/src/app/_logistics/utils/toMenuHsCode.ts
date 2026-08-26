/** Wine and sparkling, the two this business declares wine on */
const STILL_WINE = '22042100';
const SPARKLING = '22041000';

/** The codes the HS menu offers — the only ones a line should end on */
const MENU_CODES = new Set([
  STILL_WINE,
  SPARKLING,
  '22084000',
  '22083000',
  '22030000',
  '22082000',
  '22089090',
  '22085000',
  '22087000',
  '22086000',
  '22060000',
]);

/**
 * Pull a customs code back onto one of the codes the HS menu offers
 *
 * A supplier's invoice carries national subheadings — 22042143, 2204214290,
 * 22041011 — which are more specific than anything this business declares on.
 * A column mixing those with the menu's codes cannot be read at a glance or
 * matched against a rate card, and every import brought more of them in.
 *
 * The heading is taken from the digits rather than the product name: 22041011
 * is sparkling whatever the wine is called, and a name like "Bonneau Les
 * Rouliers" gives nothing away.
 *
 * @example
 *   toMenuHsCode('2204214290'); // '22042100'
 *   toMenuHsCode('22041011'); // '22041000'
 *   toMenuHsCode('22084000'); // unchanged — already on the menu
 *
 * @param hsCode - Whatever the document or the user supplied
 * @returns A menu code, or null when the input says nothing usable
 */
const toMenuHsCode = (hsCode: string | null | undefined) => {
  const digits = (hsCode ?? '').replace(/\D/g, '');

  if (digits.length < 6) return null;
  if (MENU_CODES.has(digits)) return digits;

  if (digits.startsWith('22041')) return SPARKLING;
  if (digits.startsWith('22042')) return STILL_WINE;

  // Anything else keeps its own heading padded to eight digits, which is what
  // the menu's non-wine codes look like. Guessing a wine code for a spirit
  // would be worse than leaving it recognisably unmapped.
  const heading = `${digits.slice(0, 4)}0000`;

  return MENU_CODES.has(heading) ? heading : null;
};

export default toMenuHsCode;
