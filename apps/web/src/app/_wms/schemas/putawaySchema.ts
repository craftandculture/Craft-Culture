import { z } from 'zod';

/**
 * Schema for put-away operation input
 */
export const putawaySchema = z.object({
  caseBarcode: z.string().min(1, 'Case barcode is required'),
  toLocationId: z.string().uuid('Invalid location ID'),
  notes: z.string().optional(),
});

/**
 * Schema for bulk put-away operation (multiple cases to same location)
 */
export const bulkPutawaySchema = z.object({
  caseBarcodes: z.array(z.string().min(1)).min(1, 'At least one case barcode is required'),
  toLocationId: z.string().uuid('Invalid location ID'),
  notes: z.string().optional(),
});

/**
 * Schema for getting case details by barcode
 */
export const getCaseByBarcodeSchema = z.object({
  barcode: z.string().min(1, 'Barcode is required'),
});

export type PutawayInput = z.infer<typeof putawaySchema>;
export type BulkPutawayInput = z.infer<typeof bulkPutawaySchema>;
export type GetCaseByBarcodeInput = z.infer<typeof getCaseByBarcodeSchema>;
