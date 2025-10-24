import { sql } from 'drizzle-orm';

import db from '@/database/client';
import { products } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

/**
 * Get distinct filter options for products
 *
 * @example
 *   const filterOptions = await api.products.getFilterOptions.query();
 */
const productsGetFilterOptions = protectedProcedure.query(async () => {
  const regionsResult = await db
    .selectDistinct({ value: products.region })
    .from(products)
    .where(sql`${products.region} IS NOT NULL AND ${products.region} != ''`)
    .orderBy(products.region);

  const producersResult = await db
    .selectDistinct({ value: products.producer })
    .from(products)
    .where(
      sql`${products.producer} IS NOT NULL AND ${products.producer} != ''`,
    )
    .orderBy(products.producer);

  const vintagesResult = await db
    .selectDistinct({ value: products.year })
    .from(products)
    .where(sql`${products.year} IS NOT NULL`)
    .orderBy(sql`${products.year} DESC`);

  return {
    regions: regionsResult.map((r) => r.value).filter((v): v is string => !!v),
    producers: producersResult
      .map((p) => p.value)
      .filter((v): v is string => !!v),
    vintages: vintagesResult
      .map((v) => v.value)
      .filter((v): v is number => v !== null),
  };
});

export type ProductsGetFilterOptionsOutput = Awaited<
  ReturnType<typeof productsGetFilterOptions>
>;

export default productsGetFilterOptions;
