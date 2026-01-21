/**
 * Determine the HS (Harmonized System) tariff code for a wine product
 *
 * Based on UAE/GCC import classifications for alcoholic beverages.
 *
 * @example
 *   determineHsCode('wine', 'red', null); // returns '22042100'
 *   determineHsCode('wine', null, 'champagne'); // returns '22041000'
 *   determineHsCode('spirit', null, 'whisky'); // returns '22083000'
 *
 * @param wineType - Type from LWIN: wine, fortified, spirit, beer, cider
 * @param wineColour - Colour from LWIN: red, white, rose, amber, orange
 * @param subType - Sub-type from LWIN for more specific classification
 * @returns The HS code string
 */
const determineHsCode = (
  wineType: string | null,
  wineColour: string | null,
  subType: string | null,
): string => {
  const subTypeLower = subType?.toLowerCase() ?? '';
  const typeLower = wineType?.toLowerCase() ?? '';

  // Sparkling wines (Champagne, Prosecco, Cava, Cremant, etc.)
  if (
    subTypeLower.includes('sparkling') ||
    subTypeLower.includes('champagne') ||
    subTypeLower.includes('prosecco') ||
    subTypeLower.includes('cava') ||
    subTypeLower.includes('cremant') ||
    subTypeLower.includes('spumante')
  ) {
    return '22041000';
  }

  // Fortified wines (Port, Sherry, Madeira, Marsala, Vermouth)
  if (typeLower === 'fortified') {
    if (subTypeLower.includes('vermouth')) {
      return '22051000';
    }
    return '22042100';
  }

  // Spirits
  if (typeLower === 'spirit') {
    if (subTypeLower.includes('whisky') || subTypeLower.includes('whiskey')) {
      return '22083000';
    }
    if (subTypeLower.includes('brandy') || subTypeLower.includes('cognac') || subTypeLower.includes('armagnac')) {
      return '22082000';
    }
    if (subTypeLower.includes('vodka')) {
      return '22086000';
    }
    if (subTypeLower.includes('gin')) {
      return '22085000';
    }
    if (subTypeLower.includes('rum')) {
      return '22084000';
    }
    if (subTypeLower.includes('tequila') || subTypeLower.includes('mezcal')) {
      return '22089000';
    }
    // Other spirits
    return '22089000';
  }

  // Beer
  if (typeLower === 'beer') {
    return '22030000';
  }

  // Cider
  if (typeLower === 'cider') {
    return '22060000';
  }

  // Sake
  if (typeLower === 'sake') {
    return '22060000';
  }

  // Default: Still wine in containers <= 2L (standard wine bottles)
  // 22042100 - Wine of fresh grapes in containers <= 2L
  return '22042100';
};

export default determineHsCode;
