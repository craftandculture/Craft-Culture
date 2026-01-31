import { ilike, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { searchStockSchema } from '../schemas/stockQuerySchema';

/**
 * Global search across stock, products, and locations
 * Returns quick results for autocomplete and search features
 *
 * @example
 *   await trpcClient.wms.admin.stock.search.query({
 *     query: "margaux",
 *     limit: 20
 *   });
 */
const adminSearchStock = adminProcedure
  .input(searchStockSchema)
  .query(async ({ input }) => {
    const { query, limit } = input;

    // Search products in stock
    const products = await db
      .select({
        type: sql<string>`'product'`,
        id: wmsStock.lwin18,
        title: wmsStock.productName,
        subtitle: sql<string>`CONCAT(${wmsStock.producer}, ' ', COALESCE(${wmsStock.vintage}::text, ''))`,
        meta: sql<string>`CONCAT(SUM(${wmsStock.quantityCases})::int, ' cases')`,
        totalCases: sql<number>`SUM(${wmsStock.quantityCases})::int`,
      })
      .from(wmsStock)
      .where(
        or(
          ilike(wmsStock.productName, `%${query}%`),
          ilike(wmsStock.producer, `%${query}%`),
          ilike(wmsStock.lwin18, `%${query}%`),
          ilike(wmsStock.ownerName, `%${query}%`),
        ),
      )
      .groupBy(wmsStock.lwin18, wmsStock.productName, wmsStock.producer, wmsStock.vintage)
      .orderBy(sql`SUM(${wmsStock.quantityCases}) DESC`)
      .limit(limit);

    // Search locations
    const locations = await db
      .select({
        type: sql<string>`'location'`,
        id: wmsLocations.id,
        title: wmsLocations.locationCode,
        subtitle: wmsLocations.locationType,
        meta: sql<string>`CONCAT(COALESCE(SUM(${wmsStock.quantityCases}), 0)::int, ' cases')`,
        totalCases: sql<number>`COALESCE(SUM(${wmsStock.quantityCases}), 0)::int`,
      })
      .from(wmsLocations)
      .leftJoin(wmsStock, sql`${wmsStock.locationId} = ${wmsLocations.id}`)
      .where(
        or(
          ilike(wmsLocations.locationCode, `%${query}%`),
          ilike(wmsLocations.barcode, `%${query}%`),
          ilike(wmsLocations.aisle, `%${query}%`),
        ),
      )
      .groupBy(wmsLocations.id, wmsLocations.locationCode, wmsLocations.locationType)
      .orderBy(sql`COALESCE(SUM(${wmsStock.quantityCases}), 0) DESC`)
      .limit(limit);

    // Search owners
    const owners = await db
      .select({
        type: sql<string>`'owner'`,
        id: wmsStock.ownerId,
        title: wmsStock.ownerName,
        subtitle: sql<string>`'Stock Owner'`,
        meta: sql<string>`CONCAT(SUM(${wmsStock.quantityCases})::int, ' cases, ', COUNT(DISTINCT ${wmsStock.lwin18})::int, ' products')`,
        totalCases: sql<number>`SUM(${wmsStock.quantityCases})::int`,
      })
      .from(wmsStock)
      .where(ilike(wmsStock.ownerName, `%${query}%`))
      .groupBy(wmsStock.ownerId, wmsStock.ownerName)
      .orderBy(sql`SUM(${wmsStock.quantityCases}) DESC`)
      .limit(limit);

    // Combine and sort by relevance (cases as proxy for importance)
    const allResults = [
      ...products.map((p) => ({ ...p, type: 'product' as const })),
      ...locations.map((l) => ({ ...l, type: 'location' as const })),
      ...owners.map((o) => ({ ...o, type: 'owner' as const })),
    ]
      .sort((a, b) => (b.totalCases ?? 0) - (a.totalCases ?? 0))
      .slice(0, limit);

    return {
      results: allResults,
      counts: {
        products: products.length,
        locations: locations.length,
        owners: owners.length,
        total: allResults.length,
      },
    };
  });

export default adminSearchStock;
