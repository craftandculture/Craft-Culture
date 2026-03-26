import { z } from 'zod';

/** Schema for getting paginated pricing products */
export const getPricingProductsSchema = z.object({
  search: z.string().optional(),
  category: z.enum(['Wine', 'Spirits', 'RTD']).optional(),
  ownerId: z.string().uuid().optional(),
  sortBy: z
    .enum(['productName', 'totalCases', 'importPrice', 'sellingPrice', 'margin'])
    .default('productName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

/** Schema for setting/upserting a selling price for a product */
export const setSellingPriceSchema = z.object({
  lwin18: z.string().min(1),
  sellingPricePerBottle: z.number().positive(),
});

/** Schema for bulk-applying a margin percentage to products */
export const bulkApplyMarginSchema = z.object({
  marginPercent: z.number().min(0.1).max(99.9),
  category: z.enum(['Wine', 'Spirits', 'RTD']).optional(),
  overwriteExisting: z.boolean().default(false),
});

/** Schema for setting a per-owner PC selling price */
export const setOwnerPricingSchema = z.object({
  lwin18: z.string().min(1),
  ownerId: z.string().uuid(),
  pcSellingPricePerBottle: z.number().positive(),
});

/** Schema for getting owner pricing for products in view */
export const getOwnerPricingSchema = z.object({
  lwin18s: z.array(z.string()).min(1).max(500),
  ownerId: z.string().uuid(),
});
