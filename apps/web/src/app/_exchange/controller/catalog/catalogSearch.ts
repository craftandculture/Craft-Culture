import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { products, supplierProducts } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import { catalogSearchSchema } from '../../schemas/exchangeOrderSchema';

/**
 * Search wine catalog
 *
 * Full-text search across product name, producer, and region.
 * Returns aggregated results with stock from multiple suppliers.
 *
 * @example
 *   const results = await api.exchange.catalog.search.query({
 *     query: 'Chateau Margaux',
 *     page: 1,
 *   });
 */
const catalogSearch = protectedProcedure
  .input(catalogSearchSchema)
  .query(async ({ input }) => {
    const { query, page, limit } = input;
    const offset = (page - 1) * limit;
    const searchPattern = `%${query}%`;

    // Build search conditions
    const searchConditions = or(
      ilike(products.name, searchPattern),
      ilike(products.producer, searchPattern),
      ilike(products.region, searchPattern),
      ilike(products.subRegion, searchPattern),
    );

    const conditions = and(
      eq(supplierProducts.status, 'available'),
      searchConditions,
    );

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(distinct ${supplierProducts.productId})::int` })
      .from(supplierProducts)
      .innerJoin(products, eq(supplierProducts.productId, products.id))
      .where(conditions);

    const total = countResult?.count ?? 0;

    // Get search results
    const items = await db
      .select({
        productId: products.id,
        productName: products.name,
        vintage: products.vintage,
        region: products.region,
        subRegion: products.subRegion,
        producer: products.producer,
        caseSize: sql<number>`min(${supplierProducts.caseSize})::int`,
        lowestPrice: sql<number>`min(${supplierProducts.pricePerCase})::numeric`,
        totalCasesAvailable: sql<number>`sum(${supplierProducts.casesAvailable})::int`,
        supplierCount: sql<number>`count(distinct ${supplierProducts.supplierId})::int`,
      })
      .from(supplierProducts)
      .innerJoin(products, eq(supplierProducts.productId, products.id))
      .where(conditions)
      .groupBy(
        products.id,
        products.name,
        products.vintage,
        products.region,
        products.subRegion,
        products.producer,
      )
      .orderBy(desc(sql`sum(${supplierProducts.casesAvailable})`))
      .limit(limit)
      .offset(offset);

    return {
      items,
      query,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

export default catalogSearch;
