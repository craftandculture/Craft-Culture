import db from '@/database/client';
import { protectedProcedure } from '@/lib/trpc/procedures';

import getQuoteRequestSchema from '../schemas/getQuoteRequestSchema';

const quotesGet = protectedProcedure
  .input(getQuoteRequestSchema)
  .query(async ({ input: { lineItems } }) => {
    // Filter out empty line items
    const validLineItems = lineItems.filter((item) => item.productId);

    if (validLineItems.length === 0) {
      return {
        lineItems: [],
        subtotal: 0,
        total: 0,
        currency: 'GBP',
      };
    }

    // Fetch products with their offers
    const productIds = validLineItems.map((item) => item.productId);

    const products = await db.query.products.findMany({
      where: (table, { inArray }) => inArray(table.id, productIds),
      with: {
        productOffers: {
          orderBy: {
            price: 'asc',
          },
          limit: 1,
        },
      },
    });

    // Calculate line items with prices
    const calculatedLineItems = validLineItems.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const offer = product?.productOffers?.[0];

      const unitPrice = offer?.price ?? 0;
      const lineTotal = unitPrice * item.quantity;

      return {
        productId: item.productId,
        productName: product?.name ?? 'Unknown Product',
        quantity: item.quantity,
        unitPrice,
        lineTotal,
        currency: offer?.currency ?? 'GBP',
      };
    });

    // Calculate totals
    const subtotal = calculatedLineItems.reduce(
      (sum, item) => sum + item.lineTotal,
      0,
    );

    // For now, total equals subtotal (no taxes/fees)
    const total = subtotal;

    // Get currency from first item
    const currency = calculatedLineItems[0]?.currency ?? 'GBP';

    return {
      lineItems: calculatedLineItems,
      subtotal,
      total,
      currency,
    };
  });

export default quotesGet;
