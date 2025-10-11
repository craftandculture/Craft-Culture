import { parseAsArrayOf, parseAsJson } from 'nuqs/server';
import { z } from 'zod';

const urlLineItemSchema = z.object({
  productId: z.string().uuid(),
  offerId: z.string().uuid(),
  quantity: z.number().int().min(1),
});

const quotesSearchParams = {
  items: parseAsArrayOf(parseAsJson(urlLineItemSchema)).withDefault([]),
};

export default quotesSearchParams;
