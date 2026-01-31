import { z } from 'zod';

/**
 * Schema for catalog list pagination and filtering
 */
export const catalogListSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  region: z.string().optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'name', 'newest']).default('name'),
});

/**
 * Schema for catalog search
 */
export const catalogSearchSchema = z.object({
  query: z.string().min(1).max(200),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

/**
 * Schema for getting wine detail
 */
export const catalogWineDetailSchema = z.object({
  productId: z.string().uuid(),
});

/**
 * Schema for exchange order list
 */
export const exchangeOrderListSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  status: z
    .enum([
      'pending',
      'confirmed',
      'paid',
      'picking',
      'shipped',
      'delivered',
      'cancelled',
    ])
    .optional(),
});

/**
 * Schema for getting single order
 */
export const exchangeOrderGetSchema = z.object({
  orderId: z.string().uuid(),
});

export default catalogListSchema;
