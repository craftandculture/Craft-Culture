import { z } from 'zod';

/**
 * Schema for adding an item to a logistics shipment
 */
const addItemSchema = z.object({
  shipmentId: z.string().uuid(),

  // Product reference (optional)
  productId: z.string().uuid().optional(),

  // Product details
  productName: z.string().min(1, 'Product name is required'),
  producer: z.string().optional(),
  vintage: z.number().int().min(1900).max(2100).optional(),
  region: z.string().optional(),
  countryOfOrigin: z.string().optional(),

  // Customs
  hsCode: z.string().optional(),

  // Quantity
  cases: z.number().int().min(1, 'At least 1 case required'),
  bottlesPerCase: z.number().int().min(1).default(12),
  bottleSizeMl: z.number().int().min(1).default(750),

  // Weight
  grossWeightKg: z.number().min(0).optional(),
  netWeightKg: z.number().min(0).optional(),

  // Value
  declaredValueUsd: z.number().min(0).optional(),
  productCostPerBottle: z.number().min(0).optional(),
  targetSellingPrice: z.number().min(0).optional(),

  // Notes
  notes: z.string().optional(),
});

export type AddItemInput = z.infer<typeof addItemSchema>;

export default addItemSchema;
