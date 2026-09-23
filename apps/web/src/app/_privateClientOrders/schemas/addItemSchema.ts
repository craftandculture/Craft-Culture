import { z } from 'zod';

import isUsableLwin18 from '@/app/_lwin/utils/isUsableLwin18';
import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import { orderItemSource } from '@/database/schema';

/**
 * Schema for adding a line item to a private client order
 */
const addItemSchema = z.object({
  orderId: z.string().uuid(),
  // Product reference (optional - for inventory items)
  productId: z.string().uuid().optional(),
  productOfferId: z.string().uuid().optional(),
  // Product details (required for manual entry)
  productName: z.string().min(1, 'Product name is required'),
  producer: z.string().optional(),
  vintage: z.string().optional(),
  region: z.string().optional(),
  /*
    Kept only when it is a real code. Partners pick wines from the local
    inventory sheet, whose catalogue keys ("1010000000000000000:row28") are not
    LWINs; carried onto the line they became Zoho SKUs. Dropped here, the line
    arrives without one and C&C sets it — the partner never has to.
  */
  lwin: z
    .string()
    .optional()
    .transform((value) =>
      isUsableLwin18(value) ? normalizeLwin18(value!.trim()) : undefined,
    ),
  bottleSize: z.string().optional(),
  caseConfig: z.number().int().min(1).default(12),
  // Source and quantity
  source: z.enum(orderItemSource.enumValues).default('manual'),
  quantity: z.number().int().min(1).default(1),
  pricePerCaseUsd: z.number().min(0),
  notes: z.string().optional(),
});

export default addItemSchema;
