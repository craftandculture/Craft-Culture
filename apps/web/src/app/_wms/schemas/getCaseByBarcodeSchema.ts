import { z } from 'zod';

/**
 * Schema for getting case details by barcode
 */
const getCaseByBarcodeSchema = z.object({
  barcode: z.string().min(1, 'Barcode is required'),
});

export type GetCaseByBarcodeInput = z.infer<typeof getCaseByBarcodeSchema>;

export default getCaseByBarcodeSchema;
