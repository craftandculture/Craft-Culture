import { z } from 'zod';

import cellMappingSchema from './cellMappingSchema';

const createPricingModelSchema = z.object({
  modelName: z.string().min(1, 'Model name is required'),
  sheetId: z.uuid('Invalid sheet ID'),
  isDefaultB2C: z.boolean(),
  isDefaultB2B: z.boolean(),
  cellMappings: cellMappingSchema,
});

export type CreatePricingModelSchema = z.infer<typeof createPricingModelSchema>;

export default createPricingModelSchema;
