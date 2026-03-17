import { z } from 'zod';

/**
 * Schema for repacking a case (e.g., 12-pack to 6-pack)
 */
export const repackSchema = z.object({
  caseBarcode: z.string().min(1, 'Case barcode is required'),
  targetCaseConfig: z.number().int().positive('Target case config must be positive'),
  notes: z.string().optional(),
});

const repackBaseFields = {
  stockId: z.string().uuid('Invalid stock ID'),
  sourceQuantityCases: z.number().int().positive('Source quantity must be at least 1'),
  destinationLocationId: z.string().uuid('Invalid destination location ID').optional(),
  notes: z.string().optional(),
};

/**
 * Schema for repacking by stock ID — even split (existing behavior)
 */
const repackEvenSchema = z.object({
  ...repackBaseFields,
  mode: z.literal('even'),
  targetCaseConfig: z.number().int().positive('Target case config must be positive'),
});

/**
 * Schema for repacking by stock ID — uneven/custom split (remove N bottles)
 */
const repackUnevenSchema = z.object({
  ...repackBaseFields,
  mode: z.literal('uneven'),
  bottlesToRemove: z.number().int().positive('Must remove at least 1 bottle'),
  destination2LocationId: z.string().uuid('Invalid destination location ID').optional(),
});

/**
 * Schema for repacking by stock ID
 * Supports even splits (e.g., 12-pack → 2×6-pack) and uneven splits (e.g., 6-pack → 1×2-pack + 1×4-pack)
 */
export const repackByStockSchema = z.discriminatedUnion('mode', [
  repackEvenSchema,
  repackUnevenSchema,
]);

export type RepackInput = z.infer<typeof repackSchema>;
export type RepackByStockInput = z.infer<typeof repackByStockSchema>;
