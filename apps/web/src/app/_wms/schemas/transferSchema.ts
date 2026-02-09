import { z } from 'zod';

/**
 * Schema for transferring stock (multiple cases) between locations
 */
export const transferStockSchema = z.object({
  stockId: z.string().uuid('Invalid stock ID'),
  quantityCases: z.number().int().positive('Quantity must be at least 1'),
  toLocationId: z.string().uuid('Invalid destination location ID'),
  notes: z.string().optional(),
});

/**
 * Schema for getting stock at a location (for transfer selection)
 */
export const getStockAtLocationSchema = z.object({
  locationId: z.string().uuid('Invalid location ID'),
});

/**
 * Schema for getting location by barcode
 */
export const getLocationByBarcodeSchema = z.object({
  barcode: z.string().min(1, 'Barcode is required'),
});

export type TransferStockInput = z.infer<typeof transferStockSchema>;
export type GetStockAtLocationInput = z.infer<typeof getStockAtLocationSchema>;
export type GetLocationByBarcodeInput = z.infer<typeof getLocationByBarcodeSchema>;
