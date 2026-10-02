import { HS_SPARKLING_WINE, HS_SPIRITS, HS_STILL_WINE } from '../constants';

/** Words that make a wine sparkling (shared with the logistics auto-assign) */
const SPARKLING_TERMS = [
  'champagne', 'sparkling', 'cava', 'prosecco', 'cremant', 'crémant', 'sekt', 'spumante',
  'franciacorta', 'extra brut', ' brut', 'blanc de blancs', 'blanc de noirs',
];

/**
 * Champagne houses whose wines are named without the word Champagne
 *
 * "Bérêche et Fils Grand Cru Ambonnay" and "Cristal Rosé" say nothing a keyword
 * list would catch, and both went out on EXP-2026-0040.
 */
const SPARKLING_HOUSES = [
  'bereche', 'bérêche', 'taittinger', 'roederer', 'cristal', 'krug', 'dom perignon',
  'dom pérignon', 'bollinger', 'salon', 'jacquesson', 'selosse', 'ruinart', 'pol roger',
  'billecart', 'egly-ouriet', 'laherte', 'ulysse collin', 'agrapart', 'larmandier',
];

const SPIRIT_TERMS = [
  'whisky', 'whiskey', 'bourbon', 'scotch', 'single malt', 'cognac', 'armagnac', 'brandy',
  'rum', 'vodka', 'gin', 'tequila', 'mezcal', 'liqueur',
];

/**
 * Decide the HS code a line is declared under
 *
 * Only three codes are ever declared: still wine, sparkling wine, spirits.
 * Supplier and Zoho item-master codes (10-digit TARIC, the malformed
 * `220420100`) are ignored, except that Zoho saying sparkling is believed —
 * it is never wrong in that direction. Every spirit code is 22083000 because
 * that is what has been declared to date; anything else is a manual edit.
 *
 * @example
 *   classifyHsCode('Bérêche et Fils Reflet d’Antan'); // '22041000'
 *   classifyHsCode('Brothers Bond Straight Bourbon'); // '22083000'
 *   classifyHsCode('Château Talbot 2018'); // '22042100'
 *
 * @param text - The line's name and description
 * @param zohoHsCode - Whatever code Zoho carries, if any
 * @returns The HS code to declare
 */
const classifyHsCode = (text: string, zohoHsCode?: string | null) => {
  const t = ` ${text.toLowerCase()} `;
  if (SPIRIT_TERMS.some((term) => new RegExp(`\\b${term}\\b`).test(t))) return HS_SPIRITS;
  if (zohoHsCode?.replace(/\D/g, '').startsWith('220410')) return HS_SPARKLING_WINE;
  if (SPARKLING_TERMS.some((term) => t.includes(term))) return HS_SPARKLING_WINE;
  if (SPARKLING_HOUSES.some((house) => t.includes(house))) return HS_SPARKLING_WINE;
  return HS_STILL_WINE;
};

export default classifyHsCode;
