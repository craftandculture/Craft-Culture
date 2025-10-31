import { and, eq, ne, sql } from 'drizzle-orm';

import db from '@/database/client';
import { products } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import getVintagesByProductSchema from '../schemas/getVintagesByProductSchema';

/**
 * Get available alternative vintages for a product
 *
 * Returns all vintages available for products with the same name and producer
 * Used for allowing clients to specify alternative vintage preferences
 *
 * @example
 *   const vintages = await api.products.getVintagesByProduct.query({
 *     productId: "uuid-here"
 *   });
 *   // Returns: ["2018", "2019", "2020", "2021", "2022"]
 */
const productsGetVintagesByProduct = protectedProcedure
  .input(getVintagesByProductSchema)
  .query(async ({ input }) => {
    // Get the source product
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);

    if (!product) {
      return [];
    }

    // Find all products with same producer and name but different years
    const whereConditions = [
      ne(products.id, input.productId), // Exclude the source product
      sql`${products.year} IS NOT NULL`, // Only products with vintages
    ];

    if (product.producer) {
      whereConditions.push(eq(products.producer, product.producer));
    }

    if (product.name) {
      whereConditions.push(eq(products.name, product.name));
    }

    const alternativeProducts = await db
      .select({
        year: products.year,
      })
      .from(products)
      .where(and(...whereConditions))
      .groupBy(products.year)
      .orderBy(sql`${products.year} DESC`);

    // Return array of vintage strings
    return alternativeProducts
      .filter((p): p is { year: number } => p.year !== null)
      .map((p) => p.year.toString());
  });

export type ProductsGetVintagesByProductOutput = Awaited<
  ReturnType<typeof productsGetVintagesByProduct>
>;

export default productsGetVintagesByProduct;
