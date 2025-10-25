import { desc } from 'drizzle-orm';

import db from '@/database/client';
import { products } from '@/database/schema';
import { publicProcedure } from '@/lib/trpc/procedures';

/**
 * Get the timestamp of the most recently updated product
 *
 * @example
 *   const lastUpdate = await api.products.getLastUpdate.query();
 */
const productsGetLastUpdate = publicProcedure.query(async () => {
  const result = await db
    .select({ updatedAt: products.updatedAt })
    .from(products)
    .orderBy(desc(products.updatedAt))
    .limit(1);

  return result[0]?.updatedAt ?? null;
});

export default productsGetLastUpdate;
