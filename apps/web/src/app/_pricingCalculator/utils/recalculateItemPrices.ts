import calculatePrices from './calculatePrices';
import type { CalculationVariables } from '../schemas/calculationVariablesSchema';

interface ItemInput {
  /** The source price exactly as stored: per bottle or per case */
  ukInBondPrice: number;
  inputCurrency: string;
  caseConfig: number;
  /** How the source sheet quoted ukInBondPrice (session column mapping) */
  sourcePriceType?: 'bottle' | 'case';
}

/**
 * Recalculate prices for a single item
 *
 * Used when updating case config per item. Delegates to calculatePrices so a
 * per-bottle source price is multiplied up by the new case size, exactly as
 * in the original calculation (the stored ukInBondPrice is the raw source
 * figure, not always a case price).
 */
const recalculateItemPrices = (item: ItemInput, variables: CalculationVariables) => {
  const [result] = calculatePrices(
    [
      {
        productName: '',
        ukInBondPrice: item.ukInBondPrice,
        inputCurrency: item.inputCurrency,
        caseConfig: item.caseConfig,
        sourcePriceType: item.sourcePriceType,
      },
    ],
    variables,
  );

  return result!;
};

export default recalculateItemPrices;
