import { z } from 'zod';

/** Schema for setting/upserting an import price for a product */
export const setImportPriceSchema = z.object({
  lwin18: z.string().min(1),
  importPricePerBottle: z.number().positive(),
  source: z.enum(['manual', 'shipment']).default('manual'),
  shipmentItemId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

/** Schema for auto-populating import price from shipment data */
export const autoPopulateImportPriceSchema = z.object({
  lwin18: z.string().min(1),
});

/** Schema for getting pricing for a single product */
export const getProductPricingSchema = z.object({
  lwin18: z.string().min(1),
});

/** Schema for bulk-fetching import prices for multiple products */
export const getBulkPricingSchema = z.object({
  lwin18s: z.array(z.string()).min(1).max(500),
});
