import { z } from 'zod';

/**
 * Schema for supplier product list pagination and filtering
 */
export const supplierInventoryListSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  status: z
    .enum(['incoming', 'available', 'low_stock', 'sold_out'])
    .optional(),
  search: z.string().optional(),
});

/**
 * Schema for uploading supplier inventory (Excel/CSV)
 */
export const supplierInventoryUploadSchema = z.object({
  products: z.array(
    z.object({
      lwin: z.string().optional(),
      productName: z.string().min(1),
      vintage: z.number().int().min(1900).max(2100).optional(),
      region: z.string().optional(),
      caseSize: z.number().int().positive().default(6),
      casesAvailable: z.number().int().nonnegative(),
      pricePerCase: z.number().positive(),
      currency: z.enum(['USD', 'EUR', 'GBP']).default('EUR'),
    }),
  ),
});

/**
 * Schema for updating supplier product price
 */
export const supplierProductUpdateSchema = z.object({
  supplierProductId: z.string().uuid(),
  pricePerCase: z.number().positive().optional(),
  casesAvailable: z.number().int().nonnegative().optional(),
});

export default supplierInventoryListSchema;
