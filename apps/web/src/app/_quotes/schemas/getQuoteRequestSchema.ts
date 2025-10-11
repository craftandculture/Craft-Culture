import { z } from 'zod';

const getQuoteRequestSchema = z.object({
  lineItems: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().min(1),
    }),
  ),
});

export type GetQuoteRequestSchema = z.infer<typeof getQuoteRequestSchema>;

export default getQuoteRequestSchema;
