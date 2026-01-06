import { z } from 'zod';

const updateItemSchema = z.object({
  itemId: z.string().uuid(),
  productName: z.string().min(1).optional(),
  producer: z.string().optional(),
  vintage: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  bottleSize: z.string().optional(),
  caseConfig: z.number().int().positive().optional(),
  lwin: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  adminNotes: z.string().optional(),
  finalPriceUsd: z.number().positive().optional(),
});

export default updateItemSchema;
