import { parseAsArrayOf, parseAsInteger, parseAsJson } from 'nuqs/server';
import { z } from 'zod';

const urlLineItemSchema = z.object({
  productId: z.string().uuid(),
  offerId: z.string().uuid(),
  quantity: z.number().int().min(1),
  vintage: z.string().optional(),
});

const quotesSearchParams = {
  items: parseAsArrayOf(parseAsJson(urlLineItemSchema)).withDefault([]),
  regions: parseAsArrayOf(z.string()).withDefault([]),
  producers: parseAsArrayOf(z.string()).withDefault([]),
  vintages: parseAsArrayOf(parseAsInteger).withDefault([]),
};

export default quotesSearchParams;
