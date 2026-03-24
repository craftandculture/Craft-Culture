import { and, asc, desc, eq, gt, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentItems, wmsProductPricing, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getPricingProductsSchema } from '../schemas/pricingManagerSchema';

/**
 * Get products with stock and pricing data for the Pricing Manager page
 *
 * Returns paginated products with import/selling prices, plus summary stats
 * for KPI cards (total products, avg margin, unpriced count, total values).
 */
const adminGetPricingProducts = adminProcedure
  .input(getPricingProductsSchema)
  .query(async ({ input }) => {
    const { search, category, ownerId, sortBy, sortOrder, limit, offset } = input;

    const conditions = [gt(sql`SUM(${wmsStock.quantityCases})`, 0)];
    const whereConditions = [gt(wmsStock.quantityCases, 0)];

    if (search) {
      whereConditions.push(
        or(
          ilike(wmsStock.productName, `%${search}%`),
          ilike(wmsStock.producer, `%${search}%`),
          ilike(wmsStock.lwin18, `%${search}%`),
        ),
      );
    }

    if (category) {
      if (category === 'Wine') {
        whereConditions.push(
          or(eq(wmsStock.category, 'Wine'), sql`${wmsStock.category} IS NULL`),
        );
      } else {
        whereConditions.push(eq(wmsStock.category, category));
      }
    }

    if (ownerId) {
      whereConditions.push(eq(wmsStock.ownerId, ownerId));
    }

    // Sort expression mapping
    const sortExpressions = {
      productName: sql`MAX(${wmsStock.productName})`,
      totalCases: sql`SUM(${wmsStock.quantityCases})`,
      importPrice: sql`MAX(${wmsProductPricing.importPricePerBottle})`,
      sellingPrice: sql`MAX(${wmsProductPricing.sellingPricePerBottle})`,
      margin: sql`CASE WHEN MAX(${wmsProductPricing.sellingPricePerBottle}) > 0 AND MAX(${wmsProductPricing.importPricePerBottle}) > 0 THEN (1 - MAX(${wmsProductPricing.importPricePerBottle}) / MAX(${wmsProductPricing.sellingPricePerBottle})) * 100 ELSE -999 END`,
    };

    const sortExpr = sortExpressions[sortBy];
    const orderFn = sortOrder === 'desc' ? desc : asc;

    const products = await db
      .select({
        lwin18: wmsStock.lwin18,
        productName: sql<string>`MAX(${wmsStock.productName})`,
        producer: sql<string | null>`MAX(${wmsStock.producer})`,
        caseConfig: sql<number | null>`MAX(${wmsStock.caseConfig})`,
        bottleSize: sql<string | null>`MAX(${wmsStock.bottleSize})`,
        totalCases: sql<number>`SUM(${wmsStock.quantityCases})::int`,
        category: sql<string | null>`MAX(${wmsStock.category})`,
        importPricePerBottle: sql<number | null>`MAX(${wmsProductPricing.importPricePerBottle})`,
        sellingPricePerBottle: sql<number | null>`MAX(${wmsProductPricing.sellingPricePerBottle})`,
      })
      .from(wmsStock)
      .leftJoin(wmsProductPricing, eq(wmsStock.lwin18, wmsProductPricing.lwin18))
      .where(and(...whereConditions))
      .groupBy(wmsStock.lwin18)
      .having(and(...conditions))
      .orderBy(orderFn(sortExpr))
      .limit(limit)
      .offset(offset);

    // Fill missing import prices from shipment costs (same fallback as Stock Explorer)
    const missingLwin18s = products
      .filter((p) => p.importPricePerBottle == null || p.importPricePerBottle <= 0)
      .map((p) => p.lwin18);

    const shipmentPriceMap: Record<string, number> = {};

    if (missingLwin18s.length > 0) {
      const shipmentRows = await db
        .select({
          lwin18: wmsStock.lwin18,
          productCostPerBottle: logisticsShipmentItems.productCostPerBottle,
          landedCostPerBottle: logisticsShipmentItems.landedCostPerBottle,
          createdAt: logisticsShipmentItems.createdAt,
        })
        .from(wmsStock)
        .innerJoin(
          logisticsShipmentItems,
          and(
            eq(logisticsShipmentItems.shipmentId, wmsStock.shipmentId),
            eq(logisticsShipmentItems.lwin, wmsStock.lwin18),
          ),
        )
        .where(
          and(
            inArray(wmsStock.lwin18, missingLwin18s),
            isNotNull(wmsStock.shipmentId),
          ),
        )
        .orderBy(desc(logisticsShipmentItems.createdAt));

      // Build lookup: first occurrence per lwin18 = latest shipment
      for (const row of shipmentRows) {
        if (shipmentPriceMap[row.lwin18] != null) continue;
        const cost = row.landedCostPerBottle ?? row.productCostPerBottle;
        if (cost != null) {
          shipmentPriceMap[row.lwin18] = cost;
        }
      }
    }

    // Build final products with shipment cost fallback (immutable — create new objects)
    const enrichedProducts = products.map((p) => ({
      ...p,
      importPricePerBottle:
        p.importPricePerBottle != null && p.importPricePerBottle > 0
          ? p.importPricePerBottle
          : shipmentPriceMap[p.lwin18] ?? null,
    }));

    // Count total for pagination
    const countSubquery = db
      .select({
        lwin18: wmsStock.lwin18,
        totalCases: sql<number>`SUM(${wmsStock.quantityCases})::int`,
      })
      .from(wmsStock)
      .where(and(...whereConditions))
      .groupBy(wmsStock.lwin18)
      .having(gt(sql`SUM(${wmsStock.quantityCases})`, 0))
      .as('counted');

    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(countSubquery);

    const totalCount = countResult?.count ?? 0;

    // Summary stats with shipment cost fallback
    // Uses a subquery to get the latest shipment cost per LWIN18 for products without explicit pricing
    const ownerFilter = ownerId ? sql` AND s.owner_id = ${ownerId}` : sql``;
    const [summaryResult] = await db.execute(sql`
      WITH shipment_costs AS (
        SELECT DISTINCT ON (s.lwin18)
          s.lwin18,
          COALESCE(si.landed_cost_per_bottle, si.product_cost_per_bottle) AS cost
        FROM wms_stock s
        INNER JOIN logistics_shipment_items si
          ON si.shipment_id = s.shipment_id AND si.lwin = s.lwin18
        WHERE s.quantity_cases > 0 AND s.shipment_id IS NOT NULL ${ownerFilter}
        ORDER BY s.lwin18, si.created_at DESC
      )
      SELECT
        COUNT(DISTINCT s.lwin18)::int AS "totalProducts",
        COALESCE(SUM(s.quantity_cases * s.case_config * COALESCE(p.import_price_per_bottle, sc.cost)), 0)::float AS "totalImportValue",
        COALESCE(SUM(s.quantity_cases * s.case_config * p.selling_price_per_bottle), 0)::float AS "totalSellingValue",
        COUNT(DISTINCT CASE WHEN COALESCE(p.import_price_per_bottle, sc.cost) > 0 THEN s.lwin18 END)::int AS "pricedImportCount",
        COUNT(DISTINCT CASE WHEN p.selling_price_per_bottle IS NOT NULL AND p.selling_price_per_bottle > 0 THEN s.lwin18 END)::int AS "pricedSellingCount"
      FROM wms_stock s
      LEFT JOIN wms_product_pricing p ON p.lwin18 = s.lwin18
      LEFT JOIN shipment_costs sc ON sc.lwin18 = s.lwin18
      WHERE s.quantity_cases > 0 ${ownerFilter}
    `);

    const summary = summaryResult as {
      totalProducts: number;
      totalImportValue: number;
      totalSellingValue: number;
      pricedImportCount: number;
      pricedSellingCount: number;
    };

    // Calculate avg margin with shipment cost fallback — respect owner filter
    const [marginResult] = await db.execute(sql`
      WITH shipment_costs AS (
        SELECT DISTINCT ON (s.lwin18)
          s.lwin18,
          COALESCE(si.landed_cost_per_bottle, si.product_cost_per_bottle) AS cost
        FROM wms_stock s
        INNER JOIN logistics_shipment_items si
          ON si.shipment_id = s.shipment_id AND si.lwin = s.lwin18
        WHERE s.quantity_cases > 0 AND s.shipment_id IS NOT NULL ${ownerFilter}
        ORDER BY s.lwin18, si.created_at DESC
      )
      SELECT AVG(
        CASE WHEN p.selling_price_per_bottle > 0 AND COALESCE(p.import_price_per_bottle, sc.cost) > 0
          THEN (1 - COALESCE(p.import_price_per_bottle, sc.cost) / p.selling_price_per_bottle) * 100
        END
      ) AS "avgMargin"
      FROM wms_product_pricing p
      INNER JOIN (SELECT DISTINCT lwin18 FROM wms_stock WHERE quantity_cases > 0 ${ownerFilter}) s
        ON s.lwin18 = p.lwin18
      LEFT JOIN shipment_costs sc ON sc.lwin18 = p.lwin18
    `) as Array<{ avgMargin: number | null }>;

    const unpricedCount =
      (summary?.pricedImportCount ?? 0) - (summary?.pricedSellingCount ?? 0);

    return {
      products: enrichedProducts,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + enrichedProducts.length < totalCount,
      },
      summary: {
        totalProducts: summary?.totalProducts ?? 0,
        avgMargin: marginResult?.avgMargin != null ? Math.round(marginResult.avgMargin * 10) / 10 : null,
        unpricedCount: Math.max(0, unpricedCount),
        totalImportValue: Math.round((summary?.totalImportValue ?? 0) * 100) / 100,
        totalSellingValue: Math.round((summary?.totalSellingValue ?? 0) * 100) / 100,
      },
    };
  });

export default adminGetPricingProducts;
