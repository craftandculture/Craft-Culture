import { and, desc, eq, ilike, sql } from 'drizzle-orm';

import db from '@/database/client';
import { products, supplierProducts } from '@/database/schema';
import { supplierProcedure } from '@/lib/trpc/procedures';

import { supplierInventoryListSchema } from '../../schemas/supplierProductSchema';

/**
 * Get paginated inventory list for supplier
 *
 * Returns consigned products with stock levels and pricing.
 * Supports filtering by status and search by product name.
 *
 * @example
 *   const inventory = await api.exchange.supplier.inventoryList.query({
 *     page: 1,
 *     limit: 20,
 *     status: 'available',
 *   });
 */
const supplierInventoryList = supplierProcedure
  .input(supplierInventoryListSchema)
  .query(async ({ ctx, input }) => {
    const { partnerId } = ctx;
    const { page, limit, status, search } = input;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(supplierProducts.supplierId, partnerId)];

    if (status) {
      conditions.push(eq(supplierProducts.status, status));
    }

    if (search) {
      conditions.push(ilike(products.name, `%${search}%`));
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(supplierProducts)
      .innerJoin(products, eq(supplierProducts.productId, products.id))
      .where(and(...conditions));

    const total = countResult?.count ?? 0;

    // Get paginated results
    const items = await db
      .select({
        id: supplierProducts.id,
        productId: supplierProducts.productId,
        productName: products.name,
        vintage: products.vintage,
        region: products.region,
        caseSize: supplierProducts.caseSize,
        casesAvailable: supplierProducts.casesAvailable,
        casesReserved: supplierProducts.casesReserved,
        casesSold: supplierProducts.casesSold,
        pricePerCase: supplierProducts.pricePerCase,
        currency: supplierProducts.currency,
        status: supplierProducts.status,
        createdAt: supplierProducts.createdAt,
        updatedAt: supplierProducts.updatedAt,
      })
      .from(supplierProducts)
      .innerJoin(products, eq(supplierProducts.productId, products.id))
      .where(and(...conditions))
      .orderBy(desc(supplierProducts.createdAt))
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

export default supplierInventoryList;
