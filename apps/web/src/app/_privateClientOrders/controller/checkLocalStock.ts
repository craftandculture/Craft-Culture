import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';

import checkLocalStockAvailability from './checkLocalStockAvailability';

const checkLocalStockSchema = z.object({
  productIds: z.array(z.string().uuid()),
});

/**
 * Check local stock availability for products
 *
 * Admin procedure to check C&C warehouse availability
 * for a list of product IDs.
 */
const checkLocalStock = adminProcedure
  .input(checkLocalStockSchema)
  .query(async ({ input }) => {
    const { productIds } = input;
    return checkLocalStockAvailability(productIds);
  });

export default checkLocalStock;
