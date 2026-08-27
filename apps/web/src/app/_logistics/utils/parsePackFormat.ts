export interface ParsedPackFormat {
  /** bottles per case */
  bottlesPerCase: number | null;
  /** volume of ONE bottle in millilitres */
  bottleSizeMl: number | null;
}

/**
 * Read a supplier's pack string — "6x75cl", "12 x 750ml", "1x300cl", "3x150cl".
 *
 * Merchants state the pack as text far more often than as two numeric columns,
 * and feeding that text through a numeric parser is actively dangerous: strip
 * the letters from "6x75cl" and you get 675, which then reads as a bottle size.
 * That is exactly how a 75cl bottle came to be recorded as 75,000ml.
 *
 * @example
 *   parsePackFormat('6x75cl'); // { bottlesPerCase: 6, bottleSizeMl: 750 }
 *   parsePackFormat('1x300cl'); // { bottlesPerCase: 1, bottleSizeMl: 3000 }
 *
 * @param value - The pack string as printed
 * @returns Pack and bottle size, each null when the string does not state it
 */
const parsePackFormat = (value: unknown): ParsedPackFormat => {
  const empty: ParsedPackFormat = { bottlesPerCase: null, bottleSizeMl: null };
  if (value === null || value === undefined) return empty;

  const text = String(value).toLowerCase().replace(/\s+/g, '');
  if (!text) return empty;

  // "<pack> x <size> <unit>", the unit being optional
  const match = /^(\d+)\s*[x×*]\s*(\d+(?:\.\d+)?)(cl|ml|l|litre|litres)?$/.exec(
    text,
  );
  if (!match) return empty;

  const pack = Number(match[1]);
  const size = Number(match[2]);
  const unit = match[3];

  if (!Number.isFinite(pack) || !Number.isFinite(size) || size <= 0) {
    return empty;
  }

  let bottleSizeMl: number;
  if (unit === 'ml') bottleSizeMl = size;
  else if (unit === 'cl') bottleSizeMl = size * 10;
  else if (unit) bottleSizeMl = size * 1000;
  // No unit given, so judge by magnitude: 0.75 is litres, 75 is centilitres,
  // 750 is millilitres. Nothing between 20 and 600 litres is a wine bottle.
  else if (size <= 6) bottleSizeMl = size * 1000;
  else if (size <= 600) bottleSizeMl = size * 10;
  else bottleSizeMl = size;

  return {
    bottlesPerCase: pack > 0 ? pack : null,
    bottleSizeMl: Math.round(bottleSizeMl),
  };
};

export default parsePackFormat;
