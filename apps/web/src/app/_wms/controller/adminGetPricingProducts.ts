import { and, asc, desc, eq, gt, ilike, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsProductPricing, wmsStock } from '@/database/schema';
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
    const { search, category, sortBy, sortOrder, limit, offset } = input;

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

    // Summary stats query — runs in parallel with the count
    const [summaryResult] = await db
      .select({
        totalProducts: sql<number>`COUNT(DISTINCT ${wmsStock.lwin18})::int`,
        totalImportValue: sql<number>`COALESCE(SUM(${wmsStock.quantityCases} * ${wmsStock.caseConfig} * ${wmsProductPricing.importPricePerBottle}), 0)::float`,
        totalSellingValue: sql<number>`COALESCE(SUM(${wmsStock.quantityCases} * ${wmsStock.caseConfig} * ${wmsProductPricing.sellingPricePerBottle}), 0)::float`,
        pricedImportCount: sql<number>`COUNT(DISTINCT CASE WHEN ${wmsProductPricing.importPricePerBottle} IS NOT NULL AND ${wmsProductPricing.importPricePerBottle} > 0 THEN ${wmsStock.lwin18} END)::int`,
        pricedSellingCount: sql<number>`COUNT(DISTINCT CASE WHEN ${wmsProductPricing.sellingPricePerBottle} IS NOT NULL AND ${wmsProductPricing.sellingPricePerBottle} > 0 THEN ${wmsStock.lwin18} END)::int`,
      })
      .from(wmsStock)
      .leftJoin(wmsProductPricing, eq(wmsStock.lwin18, wmsProductPricing.lwin18))
      .where(gt(wmsStock.quantityCases, 0));

    // Calculate avg margin from products that have both import and selling prices
    const [marginResult] = await db
      .select({
        avgMargin: sql<number | null>`AVG(CASE WHEN p.selling_price_per_bottle > 0 AND p.import_price_per_bottle > 0 THEN (1 - p.import_price_per_bottle / p.selling_price_per_bottle) * 100 END)`,
      })
      .from(sql`wms_product_pricing p`)
      .innerJoin(
        sql`(SELECT DISTINCT lwin18 FROM wms_stock WHERE quantity_cases > 0) s`,
        sql`s.lwin18 = p.lwin18`,
      );

    const unpricedCount =
      (summaryResult?.pricedImportCount ?? 0) - (summaryResult?.pricedSellingCount ?? 0);

    return {
      products,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + products.length < totalCount,
      },
      summary: {
        totalProducts: summaryResult?.totalProducts ?? 0,
        avgMargin: marginResult?.avgMargin != null ? Math.round(marginResult.avgMargin * 10) / 10 : null,
        unpricedCount: Math.max(0, unpricedCount),
        totalImportValue: Math.round((summaryResult?.totalImportValue ?? 0) * 100) / 100,
        totalSellingValue: Math.round((summaryResult?.totalSellingValue ?? 0) * 100) / 100,
      },
    };
  });

export default adminGetPricingProducts;
