/**
 * Strip the vintage, bottle size and ABV out of a product name for display
 *
 * Source names arrive with all of it welded on — "Domaine de Montille Bourgogne
 * Blanc 2022 0.75L 13" — which makes the product column wide and repeats what
 * the vintage and pack columns already say. Only the wine's own name is left
 * here; the untouched original still goes in the cell's title.
 *
 * @example
 *   cleanProductName('Domaine de Montille Bourgogne Blanc 2022 0.75L 13', 2022);
 *   // 'Domaine de Montille Bourgogne Blanc'
 *
 * @param name - The product name as the source wrote it
 * @param vintage - The vintage held separately, removed when it appears inline
 * @returns The name with the separately-shown attributes taken out
 */
const cleanProductName = (name: string, vintage: number | null) => {
  let cleaned = name;

  if (vintage) {
    cleaned = cleaned.replace(new RegExp(`\\b${vintage}\\b`), '');
  }

  cleaned = cleaned
    // Bottle size in either form: 0.75L, 1.5L, 75cl, 750ml
    .replace(/\b\d+(\.\d+)?\s?(L|cl|ml)\b/gi, '')
    // A bare decimal or integer at the end is the ABV
    .replace(/\s\d{1,2}(\.\d)?\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Never return an empty label — if the name was nothing but attributes,
  // the original is more use than a blank cell.
  return cleaned || name;
};

export default cleanProductName;
