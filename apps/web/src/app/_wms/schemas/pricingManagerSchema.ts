import { z } from 'zod';

/** Schema for getting paginated pricing products */
export const getPricingProductsSchema = z.object({
  search: z.string().optional(),
  category: z.enum(['Wine', 'Spirits', 'RTD']).optional(),
  ownerId: z.string().uuid().optional(),
  /** Price-gap filter: unpriced (import but no sell), lossMaking (sell ≤ import), noImport */
  priceFilter: z.enum(['unpriced', 'lossMaking', 'noImport']).optional(),
  /** Also return in-transit (inbound shipment) products as a separate list */
  includeInbound: z.boolean().optional(),
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

/**
 * Schema for a manual per-SKU landed-cost override.
 * landed = import + logistics + override. May be negative (to correct an
 * overstated import) or null (to clear the override).
 */
export const setCostOverrideSchema = z.object({
  lwin18: z.string().min(1),
  costOverridePerBottle: z.number().min(-100000).max(100000).nullable(),
});

/** Schema for bulk-applying a margin percentage to products */
export const bulkApplyMarginSchema = z.object({
  marginPercent: z.number().min(0.1).max(99.9),
  category: z.enum(['Wine', 'Spirits', 'RTD']).optional(),
  /** When set, writes per-owner PC prices instead of the default selling price */
  ownerId: z.string().uuid().optional(),
  /** Flat logistics cost per bottle added to import before applying the margin */
  logisticsPerBottle: z.number().min(0).max(1000).default(0),
  /** In-bond margin % — PC price stacks on the in-bond (B2B) price, not landed */
  inbondMarginPct: z.number().min(0).max(99.9).default(0),
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

/** Schema for reading an owner's pricing settings (logistics / margins) */
export const getOwnerPricingSettingsSchema = z.object({
  ownerId: z.string().uuid(),
});

/** Schema for upserting an owner's pricing settings */
export const setOwnerPricingSettingsSchema = z.object({
  ownerId: z.string().uuid(),
  logisticsPerBottle: z.number().min(0).max(1000),
  inbondMarginPct: z.number().min(0).max(99.9),
  pcMarginPct: z.number().min(0).max(99.9).nullable().optional(),
});
