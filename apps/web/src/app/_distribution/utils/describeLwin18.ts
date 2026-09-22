/**
 * The vintage and format a LWIN-18 encodes
 *
 * The catalogue stores a wine's name without its vintage, so a search for
 * Taittinger returns twenty rows reading "Taittinger, Comtes de Champagne
 * Blanc de Blancs" and nothing to choose between them. Everything that
 * separates them is in the code: `1314377-2011-06-00750` is the 2011, in
 * sixes, in bottles.
 *
 * @example
 *   describeLwin18('131437720110600750'); // '2011 · 6×750ml'
 *
 * @param lwin18 - The eighteen-digit code
 * @returns A short description, or null when the code is not a LWIN-18
 */
const describeLwin18 = (lwin18: string | null | undefined) => {
  const digits = (lwin18 ?? '').replace(/\D/g, '');

  if (digits.length !== 18) return null;

  const vintage = digits.slice(7, 11);
  const pack = Number(digits.slice(11, 13));
  const millilitres = Number(digits.slice(13, 18));

  /* 0000 is the code for a non-vintage wine, which is a fact worth printing */
  const year = vintage === '0000' ? 'NV' : vintage;
  const size =
    millilitres >= 1000
      ? `${millilitres / 1000}L`
      : `${millilitres}ml`;

  return `${year} · ${pack}×${size}`;
};

export default describeLwin18;
