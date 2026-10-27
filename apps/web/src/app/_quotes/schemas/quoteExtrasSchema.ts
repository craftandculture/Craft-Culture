import { z } from 'zod';

/**
 * The parts of a quote's data the customer genuinely chooses
 *
 * Prices, totals and commission are not here: the server prices every quote
 * itself from the live offers. Only the customer's own B2B markup settings and
 * out-of-catalogue wish list are accepted from the browser.
 */
const quoteExtrasSchema = z
  .object({
    marginConfig: z
      .object({
        type: z.string().max(32),
        value: z.number().finite(),
        transferCost: z.number().finite().optional(),
        importTax: z.number().finite().optional(),
      })
      .optional(),
    customerQuotePrice: z.number().finite().optional(),
    outOfCatalogueRequests: z
      .array(
        z.object({
          id: z.string().max(100),
          productName: z.string().max(500),
          vintage: z.string().max(50).optional(),
          quantity: z.number().int().min(0).max(100000).optional(),
          priceExpectation: z.string().max(200).optional(),
          notes: z.string().max(2000).optional(),
        }),
      )
      .max(100)
      .optional(),
  })
  .optional();

export type QuoteExtras = z.infer<typeof quoteExtrasSchema>;

export default quoteExtrasSchema;
