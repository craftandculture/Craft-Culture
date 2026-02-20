import { z } from 'zod';

/**
 * Schema for a single supplier wine row from an uploaded price list
 */
const supplierWineRowSchema = z.object({
  productName: z.string().min(1),
  vintage: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  bottleSize: z.string().optional(),
  costPriceUsd: z.number().optional(),
  costPriceGbp: z.number().optional(),
  costPriceEur: z.number().optional(),
  moq: z.number().int().optional(),
  availableQuantity: z.number().int().optional(),
});

/**
 * Schema for uploading a supplier wine price list
 */
const uploadSupplierListSchema = z.object({
  partnerId: z.string().uuid().optional(),
  partnerName: z.string().min(1),
  source: z.string().optional(),
  rows: z.array(supplierWineRowSchema).min(1),
  /** When true, skip deactivating previous entries (used for chunked uploads) */
  appendMode: z.boolean().optional(),
});

export type SupplierWineRow = z.infer<typeof supplierWineRowSchema>;

export default uploadSupplierListSchema;
