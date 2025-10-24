import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsJson,
  parseAsString,
} from 'nuqs/server';
import { z } from 'zod';

const urlLineItemSchema = z.object({
  productId: z.string().uuid(),
  offerId: z.string().uuid(),
  quantity: z.number().int().min(1),
  vintage: z.string().optional(),
});

const quotesSearchParams = {
  items: parseAsArrayOf(parseAsJson(urlLineItemSchema)).withDefault([]),
  regions: parseAsArrayOf(parseAsString).withDefault([]),
  producers: parseAsArrayOf(parseAsString).withDefault([]),
  vintages: parseAsArrayOf(parseAsInteger).withDefault([]),
};

export default quotesSearchParams;
