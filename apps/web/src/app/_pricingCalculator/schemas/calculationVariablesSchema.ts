import { z } from 'zod';

/**
 * Schema for pricing calculation variables
 *
 * Includes currency rates, margin settings, freight costs, and D2C parameters
 */
const calculationVariablesSchema = z.object({
  // Currency & Exchange Rates
  inputCurrency: z.enum(['GBP', 'EUR', 'USD']),
  gbpToUsdRate: z.number().positive(),
  eurToUsdRate: z.number().positive(),
  usdToAedRate: z.number().positive(),

  // Margin (applied BEFORE freight)
  marginType: z.enum(['percentage', 'absolute']),
  marginPercent: z.number().min(0).max(100),
  marginAbsolute: z.number().min(0),

  // Freight (per bottle)
  shippingMethod: z.enum(['air', 'sea']),
  airFreightPerBottle: z.number().min(0),
  seaFreightPerBottle: z.number().min(0),

  // D2C only
  salesAdvisorMarginPercent: z.number().min(0).max(100),
  importDutyPercent: z.number().min(0).max(100),
  localCosts: z.number().min(0),
  vatPercent: z.number().min(0).max(100),
});

export type CalculationVariables = z.infer<typeof calculationVariablesSchema>;

/**
 * Default values for calculation variables
 */
export const defaultCalculationVariables: CalculationVariables = {
  inputCurrency: 'GBP',
  gbpToUsdRate: 1.27,
  eurToUsdRate: 1.08,
  usdToAedRate: 3.67,
  marginType: 'percentage',
  marginPercent: 5,
  marginAbsolute: 0,
  shippingMethod: 'sea',
  airFreightPerBottle: 4,
  seaFreightPerBottle: 1.5,
  salesAdvisorMarginPercent: 10,
  importDutyPercent: 50,
  localCosts: 5,
  vatPercent: 5,
};

export default calculationVariablesSchema;
