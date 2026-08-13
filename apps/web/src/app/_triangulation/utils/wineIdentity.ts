export interface WineIdentity {
  /** Vintage read from the name, or the column when the name omits it */
  vintage: number | null;
  /** Bottle size in ml, so 1.5L and 75cl compare as numbers */
  sizeMl: number | null;
  /** The name with vintage, size and ABV removed, lowercased for comparison */
  base: string;
}

/**
 * Break a product name into the parts that decide whether two SKUs are one wine
 *
 * Vintage and bottle size are not decoration: "Di Meo Greco di Tufo Riserva
 * 2008 1.5L" and the same wine in 0.75L are different SKUs that must not be
 * merged, and so are two vintages of one cuvée. Both are usually only in the
 * name — the vintage and bottle-size columns are often empty — so comparing the
 * columns alone finds them identical.
 *
 * @param name - The product name as stored
 * @param vintage - The vintage column, used only when the name has none
 * @param bottleSize - The bottle size column, used only when the name has none
 */
const wineIdentity = (
  name: string,
  vintage: number | null,
  bottleSize: string | null,
): WineIdentity => {
  const yearMatch = /\b(19|20)\d{2}\b/.exec(name);
  const fromName = yearMatch ? Number(yearMatch[0]) : null;

  const sizeOf = (text: string) => {
    const litres = /(\d+(?:\.\d+)?)\s*L\b/i.exec(text);
    if (litres?.[1]) return Math.round(Number(litres[1]) * 1000);

    const cl = /(\d+(?:\.\d+)?)\s*cl\b/i.exec(text);
    if (cl?.[1]) return Math.round(Number(cl[1]) * 10);

    const ml = /(\d+)\s*ml\b/i.exec(text);
    if (ml?.[1]) return Number(ml[1]);

    // Named formats carry a size just as firmly as a number does.
    if (/\bmagnum\b/i.test(text)) return 1500;
    if (/\bhalf\b/i.test(text)) return 375;

    return null;
  };

  const base = name
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/\d+(?:\.\d+)?\s*(L|cl|ml)\b/gi, '')
    .replace(/\b(magnum|half)\b/gi, '')
    .replace(/\s\d{1,2}(\.\d)?\s*$/, '')
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase();

  return {
    vintage: fromName ?? vintage,
    sizeMl: sizeOf(name) ?? (bottleSize ? sizeOf(bottleSize) : null),
    base,
  };
};

export default wineIdentity;
