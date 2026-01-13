import { z } from 'zod';

const addCustomerPoItemSchema = z.object({
  customerPoId: z.string().uuid(),
  productName: z.string().min(1, 'Product name is required'),
  producer: z.string().optional(),
  vintage: z.string().optional(),
  region: z.string().optional(),
  lwin: z.string().optional(),
  quantity: z.number().int().min(1, 'Quantity is required'),
  quantityUnit: z.enum(['cases', 'bottles']).default('cases'),
  caseConfig: z.number().int().optional(),
  bottleSize: z.string().optional(),
  sellPricePerCaseUsd: z.number().min(0).optional(),
  sellPricePerBottleUsd: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export default addCustomerPoItemSchema;
