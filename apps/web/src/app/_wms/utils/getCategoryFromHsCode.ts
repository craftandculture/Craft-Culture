/**
 * Derive stock category from HS code
 * Defaults to 'Wine' when no HS code is provided
 *
 * @example
 *   getCategoryFromHsCode('22042100'); // 'Wine'
 *   getCategoryFromHsCode('22083000'); // 'Spirits'
 *   getCategoryFromHsCode('22030000'); // 'RTD'
 *   getCategoryFromHsCode(null);       // 'Wine'
 *
 * @param hsCode - The HS code from the shipment item
 * @returns The stock category
 */
const getCategoryFromHsCode = (hsCode?: string | null): 'Wine' | 'Spirits' | 'RTD' => {
  if (!hsCode) return 'Wine';

  const spiritCodes = new Set([
    '22084000', // Rum
    '22083000', // Whisky
    '22082000', // Brandy
    '22089090', // Tequila/Spirit
    '22085000', // Gin
    '22087000', // Liquor
    '22086000', // Vodka
  ]);

  const rtdCodes = new Set([
    '22030000', // Beer
    '22060000', // Cider
  ]);

  if (spiritCodes.has(hsCode)) return 'Spirits';
  if (rtdCodes.has(hsCode)) return 'RTD';
  return 'Wine';
};

export default getCategoryFromHsCode;
