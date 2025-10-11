import { protectedProcedure } from '@/lib/trpc/procedures';

import getQuoteRequestSchema from '../schemas/getQuoteRequestSchema';

const quotesGet = protectedProcedure
  .input(getQuoteRequestSchema)
  .query(async ({ input: { lineItems } }) => {
    return {
      lineItems: lineItems.map((lineItem) => ({
        lineTotal: 200,
        productId: lineItem.productId,
        quantity: lineItem.quantity,
      })),
      subtotal: 200,
      total: 200,
      currency: 'GBP',
    };
  });

export default quotesGet;
