import { z } from 'zod';

const getQuoteRequestSchema = z.object({
  lineItems: z.array(
    z.object({
      productId: z.uuid(),
      offerId: z.uuid(),
      quantity: z.number().int().min(1),
      vintage: z.string().optional(),
      alternativeVintages: z.array(z.string()).optional(),
    }),
  ),
});

export type GetQuoteRequestSchema = z.infer<typeof getQuoteRequestSchema>;

export default getQuoteRequestSchema;
