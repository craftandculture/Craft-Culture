import { z } from 'zod';

const addItemSchema = z.object({
  rfqId: z.string().uuid(),
  productName: z.string().min(1, 'Product name is required'),
  producer: z.string().optional(),
  vintage: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  bottleSize: z.string().optional(),
  caseConfig: z.number().int().positive().optional(),
  lwin: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  originalText: z.string().optional(),
  parseConfidence: z.number().min(0).max(1).optional(),
  adminNotes: z.string().optional(),
});

export default addItemSchema;
