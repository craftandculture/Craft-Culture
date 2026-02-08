import { z } from 'zod';

/**
 * Schema for an extracted line item to import
 */
const extractedItemSchema = z.object({
  description: z.string().optional(),
  productName: z.string().optional(),
  lwin: z.string().optional(),
  supplierSku: z.string().optional(), // Supplier's own reference code (e.g., W-codes from CRURATED)
  producer: z.string().optional(),
  vintage: z.number().optional(),
  bottleSize: z.string().optional(),
  bottlesPerCase: z.number().optional(),
  alcoholPercent: z.number().optional(),
  region: z.string().optional(),
  hsCode: z.string().optional(),
  quantity: z.number().optional(),
  cases: z.number().optional(),
  weight: z.number().optional(),
  volume: z.number().optional(),
  unitPrice: z.number().optional(),
  total: z.number().optional(),
  countryOfOrigin: z.string().optional(),
});

/**
 * Schema for cargo summary data (from packing lists, BOLs)
 */
const cargoSummarySchema = z.object({
  totalCases: z.number().optional(),
  totalPallets: z.number().optional(),
  totalWeight: z.number().optional(), // kg
  totalVolume: z.number().optional(), // m³
});

/**
 * Schema for importing extracted items to a shipment
 */
const importExtractedItemsSchema = z.object({
  shipmentId: z.string().uuid(),
  items: z.array(extractedItemSchema).min(1, 'At least one item is required'),
  // Optional cargo summary data to update on shipment
  cargoSummary: cargoSummarySchema.optional(),
  // Whether to update shipment cargo fields (even if they have values)
  overwriteCargoData: z.boolean().optional().default(false),
});

export type ImportExtractedItemsInput = z.infer<typeof importExtractedItemsSchema>;
export type ExtractedItem = z.infer<typeof extractedItemSchema>;
export type CargoSummary = z.infer<typeof cargoSummarySchema>;

export default importExtractedItemsSchema;
