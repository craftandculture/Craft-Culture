import { z } from 'zod';

const getQuoteSchema = z.object({
  lineItems: z
    .array(
      z.object({
        productId: z.uuid('Invalid product').optional(),
        quantity: z
          .number()
          .int('Quantity must be a whole number')
          .min(1, 'Quantity must be at least 1')
          .optional(),
      }),
    )
    .min(1, 'Please add at least one product')
    .max(10, 'You can add up to 10 products maximum'),
});

export type GetQuoteSchema = z.infer<typeof getQuoteSchema>;

export default getQuoteSchema;
