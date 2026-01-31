import { TRPCError } from '@trpc/server';
import { and, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { partners, products, supplierProducts } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import { catalogWineDetailSchema } from '../../schemas/exchangeOrderSchema';

/**
 * Get wine detail with supplier offerings
 *
 * Returns detailed product information along with all available
 * supplier offerings and their prices.
 *
 * @example
 *   const wine = await api.exchange.catalog.wine.query({
 *     productId: 'uuid',
 *   });
 */
const catalogWineDetail = protectedProcedure
  .input(catalogWineDetailSchema)
  .query(async ({ input }) => {
    const { productId } = input;

    // Get product details
    const [product] = await db
      .select({
        id: products.id,
        name: products.name,
        vintage: products.vintage,
        region: products.region,
        subRegion: products.subRegion,
        appellation: products.appellation,
        producer: products.producer,
        color: products.color,
        grapeVariety: products.grapeVariety,
        alcoholContent: products.alcoholContent,
        description: products.description,
        lwin: products.lwin,
      })
      .from(products)
      .where(eq(products.id, productId));

    if (!product) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Product not found',
      });
    }

    // Get all available supplier offerings
    const offerings = await db
      .select({
        supplierProductId: supplierProducts.id,
        supplierId: supplierProducts.supplierId,
        supplierName: partners.businessName,
        caseSize: supplierProducts.caseSize,
        casesAvailable: supplierProducts.casesAvailable,
        pricePerCase: supplierProducts.pricePerCase,
        currency: supplierProducts.currency,
        pricePerBottle: sql<number>`(${supplierProducts.pricePerCase}::numeric / ${supplierProducts.caseSize})::numeric(10,2)`,
      })
      .from(supplierProducts)
      .innerJoin(partners, eq(supplierProducts.supplierId, partners.id))
      .where(
        and(
          eq(supplierProducts.productId, productId),
          eq(supplierProducts.status, 'available'),
        ),
      )
      .orderBy(supplierProducts.pricePerCase);

    // Calculate aggregate stats
    const totalCasesAvailable = offerings.reduce(
      (sum, o) => sum + (o.casesAvailable ?? 0),
      0,
    );
    const lowestPrice =
      offerings.length > 0
        ? Math.min(...offerings.map((o) => Number(o.pricePerCase)))
        : null;
    const highestPrice =
      offerings.length > 0
        ? Math.max(...offerings.map((o) => Number(o.pricePerCase)))
        : null;

    return {
      product,
      offerings,
      stats: {
        totalCasesAvailable,
        lowestPrice,
        highestPrice,
        supplierCount: offerings.length,
      },
    };
  });

export default catalogWineDetail;
