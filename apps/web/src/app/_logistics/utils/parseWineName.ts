export interface ParsedWineName {
  /** The wine, with vintage, size and strength stripped off */
  searchName: string;
  vintage: number | null;
  bottleSizeMl: number | null;
  alcoholPercent: number | null;
}

/** 1900–2099, so a 75cl or a 12.5 cannot be read as a year */
const VINTAGE = /\b(19\d{2}|20\d{2})\b/;
const SIZE_L = /\b(\d+(?:[.,]\d+)?)\s*L\b/i;
const SIZE_CL = /\b(\d+(?:[.,]\d+)?)\s*cl\b/i;
const SIZE_ML = /\b(\d+)\s*ml\b/i;
const ABV = /\b(\d+(?:[.,]\d+)?)\s*%\s*(?:abv)?/i;

const num = (value: string) => Number(value.replace(',', '.'));

/**
 * Pull the vintage, bottle size and strength out of a supplier's product name
 *
 * Suppliers write the whole wine into one string — "ANTOINE LIENHARDT Côte de
 * Nuits Villages Rouge Emphase 2023 0.75L 12.5%abv" — so the three fields a
 * person would otherwise pick from dropdowns are already there, and leaving
 * them in the string also stops the wine matching: no LWIN record is called
 * "... 2023 0.75L 12.5%abv".
 *
 * Stripping them does both jobs at once — fills the fields, and leaves a name
 * that can actually be searched.
 *
 * @param name - Product name as the supplier wrote it
 * @returns The searchable wine name and whatever the string stated
 */
const parseWineName = (name: string): ParsedWineName => {
  const original = String(name ?? '');

  const vintageMatch = VINTAGE.exec(original);
  const abvMatch = ABV.exec(original);

  let bottleSizeMl: number | null = null;
  const litres = SIZE_L.exec(original);
  const centilitres = SIZE_CL.exec(original);
  const millilitres = SIZE_ML.exec(original);

  if (litres?.[1]) bottleSizeMl = Math.round(num(litres[1]) * 1000);
  else if (centilitres?.[1]) bottleSizeMl = Math.round(num(centilitres[1]) * 10);
  else if (millilitres?.[1]) bottleSizeMl = Math.round(num(millilitres[1]));

  const searchName = original
    .replace(ABV, ' ')
    .replace(SIZE_L, ' ')
    .replace(SIZE_CL, ' ')
    .replace(SIZE_ML, ' ')
    .replace(VINTAGE, ' ')
    // "NV" carries no identity and only ever costs a match
    .replace(/\bNV\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    searchName,
    vintage: vintageMatch?.[1] ? Number(vintageMatch[1]) : null,
    bottleSizeMl,
    alcoholPercent: abvMatch?.[1] ? num(abvMatch[1]) : null,
  };
};

export default parseWineName;
