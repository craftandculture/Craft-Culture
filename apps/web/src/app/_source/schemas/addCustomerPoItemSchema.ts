import { z } from 'zod';

const addCustomerPoItemSchema = z.object({
  customerPoId: z.string().uuid(),
  productName: z.string().min(1, 'Product name is required'),
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
  notes: z.string().optional(),
});

export default addCustomerPoItemSchema;
