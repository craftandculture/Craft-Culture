import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getStockByProductSchema } from '../schemas/stockQuerySchema';

/**
 * Get stock grouped by product (LWIN) with location breakdown
 * Shows all products in warehouse with quantities across all locations
 *
 * @example
 *   await trpcClient.wms.admin.stock.getByProduct.query({
 *     search: "margaux",
 *     ownerId: "uuid",
 *     limit: 50,
 *     offset: 0
 *   });
 */
const adminGetStockByProduct = adminProcedure
  .input(getStockByProductSchema)
  .query(async ({ input }) => {
    const { search, ownerId, hasExpiry, vintageFrom, vintageTo, sortBy, sortOrder, limit, offset } =
      input;

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(wmsStock.productName, `%${search}%`),
          ilike(wmsStock.producer, `%${search}%`),
          ilike(wmsStock.lwin18, `%${search}%`),
        ),
      );
    }

    if (ownerId) {
      conditions.push(eq(wmsStock.ownerId, ownerId));
    }

    if (hasExpiry) {
      conditions.push(sql`${wmsStock.expiryDate} IS NOT NULL`);
    }

    if (vintageFrom) {
      conditions.push(sql`${wmsStock.vintage} >= ${vintageFrom}`);
    }

    if (vintageTo) {
      conditions.push(sql`${wmsStock.vintage} <= ${vintageTo}`);
    }

    // Get products with aggregated stock info, grouped by LWIN18 only
    // (same product received from different shipments may have slightly different names)
    const products = await db
      .select({
        lwin18: wmsStock.lwin18,
        productName: sql<string>`MAX(${wmsStock.productName})`,
        producer: sql<string | null>`MAX(${wmsStock.producer})`,
        vintage: sql<string | null>`MAX(${wmsStock.vintage})`,
        bottleSize: sql<string | null>`MAX(${wmsStock.bottleSize})`,
        caseConfig: sql<number | null>`MAX(${wmsStock.caseConfig})`,
        totalCases: sql<number>`SUM(${wmsStock.quantityCases})::int`,
        availableCases: sql<number>`SUM(${wmsStock.availableCases})::int`,
        reservedCases: sql<number>`SUM(${wmsStock.reservedCases})::int`,
        locationCount: sql<number>`COUNT(DISTINCT ${wmsStock.locationId})::int`,
        ownerCount: sql<number>`COUNT(DISTINCT ${wmsStock.ownerId})::int`,
        earliestExpiry: sql<Date | null>`MIN(${wmsStock.expiryDate})`,
        hasPerishable: sql<boolean>`BOOL_OR(${wmsStock.isPerishable})`,
      })
      .from(wmsStock)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(wmsStock.lwin18)
      .orderBy(
        sortOrder === 'desc'
          ? desc(
              sortBy === 'totalCases'
                ? sql`SUM(${wmsStock.quantityCases})`
                : sortBy === 'productName'
                  ? sql`MAX(${wmsStock.productName})`
                  : sortBy === 'vintage'
                    ? sql`MAX(${wmsStock.vintage})`
                    : sql`MAX(${wmsStock.receivedAt})`,
            )
          : asc(
              sortBy === 'totalCases'
                ? sql`SUM(${wmsStock.quantityCases})`
                : sortBy === 'productName'
                  ? sql`MAX(${wmsStock.productName})`
                  : sortBy === 'vintage'
                    ? sql`MAX(${wmsStock.vintage})`
                    : sql`MAX(${wmsStock.receivedAt})`,
            ),
      )
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [countResult] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${wmsStock.lwin18})::int`,
      })
      .from(wmsStock)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // For each product, get location breakdown
    const productsWithLocations = await Promise.all(
      products.map(async (product) => {
        const locations = await db
          .select({
            stockId: wmsStock.id,
            locationId: wmsStock.locationId,
            locationCode: wmsLocations.locationCode,
            locationType: wmsLocations.locationType,
            quantityCases: wmsStock.quantityCases,
            availableCases: wmsStock.availableCases,
            ownerId: wmsStock.ownerId,
            ownerName: wmsStock.ownerName,
            lotNumber: wmsStock.lotNumber,
            expiryDate: wmsStock.expiryDate,
          })
          .from(wmsStock)
          .innerJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
          .where(eq(wmsStock.lwin18, product.lwin18))
          .orderBy(asc(wmsLocations.locationCode));

        // Calculate expiry status
        const now = new Date();
        const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        let expiryStatus: 'none' | 'ok' | 'warning' | 'critical' | 'expired' = 'none';

        if (product.earliestExpiry) {
          if (product.earliestExpiry < now) {
            expiryStatus = 'expired';
          } else if (product.earliestExpiry <= thirtyDays) {
            expiryStatus = 'critical';
          } else {
            expiryStatus = 'warning';
          }
        } else if (!product.hasPerishable) {
          expiryStatus = 'ok';
        }

        return {
          ...product,
          locations,
          expiryStatus,
          totalBottles: product.totalCases * (product.caseConfig ?? 1),
        };
      }),
    );

    return {
      products: productsWithLocations,
      pagination: {
        total: countResult?.count ?? 0,
        limit,
        offset,
        hasMore: offset + products.length < (countResult?.count ?? 0),
      },
    };
  });

export default adminGetStockByProduct;
