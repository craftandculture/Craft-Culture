import { z } from 'zod';

/** Schema for setting/upserting an import price for a product */
export const setImportPriceSchema = z.object({
  /** The partner whose holding this is; a wine several hold is priced per owner */
  ownerId: z.string().uuid().nullish(),
  lwin18: z.string().min(1),
  importPricePerBottle: z.number().positive(),
  source: z.enum(['manual', 'shipment']).default('manual'),
  shipmentItemId: z.string().uuid().optional(),
  notes: z.string().optional(),
  /**
   * Typed on an in-transit line. A typed price wins over the shipment's figure
   * there, so it is never refused for the stock's invoice.
   */
  inTransit: z.boolean().optional(),
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
