import { z } from 'zod';

import { orderItemSource } from '@/database/schema';

/**
 * Schema for adding a line item to a private client order
 */
const addItemSchema = z.object({
  orderId: z.string().uuid(),
  // Product reference (optional - for inventory items)
  productId: z.string().uuid().optional(),
  productOfferId: z.string().uuid().optional(),
  // Product details (required for manual entry)
  productName: z.string().min(1, 'Product name is required'),
  producer: z.string().optional(),
  vintage: z.string().optional(),
  region: z.string().optional(),
  lwin: z.string().optional(),
  bottleSize: z.string().optional(),
  caseConfig: z.number().int().min(1).default(12),
  // Source and quantity
  source: z.enum(orderItemSource.enumValues).default('manual'),
  quantity: z.number().int().min(1).default(1),
  pricePerCaseUsd: z.number().min(0),
  notes: z.string().optional(),
});

export default addItemSchema;
