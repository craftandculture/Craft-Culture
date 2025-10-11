import { z } from 'zod';

const assignUserPricingModelSchema = z.object({
  userId: z.string().uuid(),
  pricingModelId: z.string().uuid().nullable(),
});

export type AssignUserPricingModelSchema = z.infer<
  typeof assignUserPricingModelSchema
>;

export default assignUserPricingModelSchema;
