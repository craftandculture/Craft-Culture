import { z } from 'zod';

import { sourceCustomerPoItemStatus } from '@/database/schema';

const updateCustomerPoItemSchema = z.object({
  id: z.string().uuid(),
  productName: z.string().min(1).optional(),
  producer: z.string().optional(),
  vintage: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  lwin: z.string().optional(),
  quantityCases: z.number().min(1).optional(),
  quantityBottles: z.number().min(1).optional(),
  caseConfig: z.string().optional(),
  bottleSize: z.string().optional(),
  sellPricePerCaseUsd: z.number().min(0).optional(),
  sellPricePerBottleUsd: z.number().min(0).optional(),
  matchedQuoteId: z.string().uuid().nullable().optional(),
  buyPricePerCaseUsd: z.number().min(0).nullable().optional(),
  status: z.enum(sourceCustomerPoItemStatus.enumValues).optional(),
  notes: z.string().optional(),
});

export default updateCustomerPoItemSchema;
