import { z } from 'zod';

/**
 * Schema for creating a new pallet
 */
export const createPalletSchema = z.object({
  ownerId: z.string().uuid(),
  storageType: z.string().optional().default('customer_storage'),
  notes: z.string().optional(),
});

export type CreatePalletInput = z.infer<typeof createPalletSchema>;

/**
 * Schema for adding a case to a pallet
 */
export const addCaseToPalletSchema = z.object({
  palletId: z.string().uuid(),
  caseBarcode: z.string().min(1),
});

export type AddCaseToPalletInput = z.infer<typeof addCaseToPalletSchema>;

/**
 * Schema for removing a case from a pallet
 */
export const removeCaseFromPalletSchema = z.object({
  palletId: z.string().uuid(),
  caseBarcode: z.string().min(1),
  reason: z.string().optional(),
});

export type RemoveCaseFromPalletInput = z.infer<typeof removeCaseFromPalletSchema>;

/**
 * Schema for sealing a pallet
 */
export const sealPalletSchema = z.object({
  palletId: z.string().uuid(),
});

export type SealPalletInput = z.infer<typeof sealPalletSchema>;

/**
 * Schema for moving a pallet to a location
 */
export const movePalletSchema = z.object({
  palletId: z.string().uuid(),
  toLocationId: z.string().uuid(),
});

export type MovePalletInput = z.infer<typeof movePalletSchema>;

/**
 * Schema for getting a pallet by ID
 */
export const getPalletSchema = z.object({
  palletId: z.string().uuid(),
});

export type GetPalletInput = z.infer<typeof getPalletSchema>;

/**
 * Schema for getting a pallet by barcode
 */
export const getPalletByBarcodeSchema = z.object({
  barcode: z.string().min(1),
});

export type GetPalletByBarcodeInput = z.infer<typeof getPalletByBarcodeSchema>;

/**
 * Schema for listing pallets with filters
 */
export const getPalletsSchema = z.object({
  status: z.enum(['active', 'sealed', 'retrieved', 'archived']).optional(),
  ownerId: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).optional().default(50),
});

export type GetPalletsInput = z.infer<typeof getPalletsSchema>;
