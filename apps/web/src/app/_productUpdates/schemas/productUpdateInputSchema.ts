import { z } from 'zod';

const productUpdateInputSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(['feature', 'improvement', 'fix']),
  audiences: z.array(z.enum(['collector', 'wine_partner'])),
  title: z.string().trim().max(200),
  body: z.string().trim().max(1000),
  linkPath: z.string().nullable(),
});

export default productUpdateInputSchema;
