import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';

import db from '@/database/client';
import { products, supplierProducts } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import { catalogListSchema } from '../../schemas/exchangeOrderSchema';

/**
 * Get paginated wine catalog
 *
 * Returns unified catalog of available wines from all suppliers.
 * Aggregates stock from multiple suppliers per product.
 * Accessible to all authenticated partners.
 *
 * @example
 *   const catalog = await api.exchange.catalog.list.query({
 *     page: 1,
 *     sortBy: 'price_asc',
 *     region: 'Burgundy',
 *   });
 */
const catalogList = protectedProcedure
  .input(catalogListSchema)
  .query(async ({ input }) => {
    const { page, limit, region, minPrice, maxPrice, sortBy } = input;
    const offset = (page - 1) * limit;

    // Build conditions - only show available products
    const conditions = [eq(supplierProducts.status, 'available')];

    if (region) {
      conditions.push(eq(products.region, region));
    }

    if (minPrice) {
      conditions.push(gte(supplierProducts.pricePerCase, minPrice.toString()));
    }

    if (maxPrice) {
      conditions.push(lte(supplierProducts.pricePerCase, maxPrice.toString()));
    }

    // Get total unique products
    const [countResult] = await db
      .select({ count: sql<number>`count(distinct ${supplierProducts.productId})::int` })
      .from(supplierProducts)
      .innerJoin(products, eq(supplierProducts.productId, products.id))
      .where(and(...conditions));

    const total = countResult?.count ?? 0;

    // Build sort order
    const orderByClause = (() => {
      switch (sortBy) {
        case 'price_asc':
          return asc(sql`min(${supplierProducts.pricePerCase})`);
        case 'price_desc':
          return desc(sql`min(${supplierProducts.pricePerCase})`);
        case 'newest':
          return desc(sql`max(${supplierProducts.createdAt})`);
        case 'name':
        default:
          return asc(products.name);
      }
    })();

    // Get aggregated products with lowest prices
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
      .where(and(...conditions))
      .groupBy(
        products.id,
        products.name,
        products.vintage,
        products.region,
        products.subRegion,
        products.producer,
      )
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

export default catalogList;
