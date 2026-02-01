import { z } from 'zod';

/**
 * Schema for an extracted line item to import
 */
const extractedItemSchema = z.object({
  description: z.string().optional(),
  productName: z.string().optional(),
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
 * Schema for importing extracted items to a shipment
 */
const importExtractedItemsSchema = z.object({
  shipmentId: z.string().uuid(),
  items: z.array(extractedItemSchema).min(1, 'At least one item is required'),
});

export type ImportExtractedItemsInput = z.infer<typeof importExtractedItemsSchema>;
export type ExtractedItem = z.infer<typeof extractedItemSchema>;

export default importExtractedItemsSchema;
