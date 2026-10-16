import type { WineSource } from './wineSources';

/**
 * Popular places a collector's wine is held, offered as search suggestions
 *
 * Suggestions only: anyone not listed can still be typed, so the list can be
 * short and is never a reason to lose an applicant.
 */
const wineHolders: Partial<Record<WineSource, readonly string[]>> = {
  uk_eu_cellar: [
    'Octavian Vaults (Corsham)',
    'Coterie Vaults',
    'Vinothèque (Burton-on-Trent)',
    'Berry Bros. & Rudd',
    'Justerini & Brooks',
    'Corney & Barrow',
    'Farr Vintners',
    'Fine & Rare',
    'Lay & Wheeler',
    'Goedhuis & Co',
    'Bordeaux Index',
    'Jeroboams',
    'Armit Wines',
    'Hedonism Wines',
    'The Wine Society',
    'Millésima (France)',
    'Cavissima (France)',
  ],
  investment_company: [
    'Cult Wines',
    'Cru Wine',
    'Bordeaux Index',
    'OENO Group',
    'Vin-X',
    'WineCap',
    'Vinovest',
    'Crurated',
  ],
};

export default wineHolders;
