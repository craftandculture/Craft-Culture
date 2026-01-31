import { z } from 'zod';

/**
 * Schema for repacking a case (e.g., 12-pack to 6-pack)
 */
export const repackSchema = z.object({
  caseBarcode: z.string().min(1, 'Case barcode is required'),
  targetCaseConfig: z.number().int().positive('Target case config must be positive'),
  notes: z.string().optional(),
});

/**
 * Schema for repacking by stock ID
 */
export const repackByStockSchema = z.object({
  stockId: z.string().uuid('Invalid stock ID'),
  sourceQuantityCases: z.number().int().positive('Source quantity must be at least 1'),
  targetCaseConfig: z.number().int().positive('Target case config must be positive'),
  notes: z.string().optional(),
});

/**
 * Schema for getting available repack configurations
 */
export const getRepackOptionsSchema = z.object({
  caseBarcode: z.string().min(1, 'Case barcode is required'),
});

export type RepackInput = z.infer<typeof repackSchema>;
export type RepackByStockInput = z.infer<typeof repackByStockSchema>;
export type GetRepackOptionsInput = z.infer<typeof getRepackOptionsSchema>;
