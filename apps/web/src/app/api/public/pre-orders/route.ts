import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import db from '@/database/client';
import { products, wmsStock } from '@/database/schema';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://craftculture.xyz',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

/**
 * OPTIONS /api/public/pre-orders
 * CORS preflight handler
 */
export const OPTIONS = () => {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/public/pre-orders
 *
 * Public endpoint returning available warehouse stock for the pre-order marketing page.
 * Queries WMS stock grouped by product, joined with product master data for region/country.
 * No authentication required. Cached for 5 minutes.
 *
 * @example
 *   GET /api/public/pre-orders?category=Wine&limit=50
 */
export const GET = async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || undefined;
    const limitParam = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1),
      200,
    );
    const offsetParam = Math.max(
      parseInt(searchParams.get('offset') || '0', 10) || 0,
      0,
    );
    const sortBy = searchParams.get('sortBy') || 'totalCases';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const conditions = [sql`${wmsStock.availableCases} > 0`];

    if (category) {
      conditions.push(eq(wmsStock.category, category));
    }

    const orderExpr =
      sortBy === 'productName'
        ? sql`MAX(${wmsStock.productName})`
        : sortBy === 'vintage'
          ? sql`MAX(${wmsStock.vintage})`
          : sql`SUM(${wmsStock.availableCases})`;

    const orderFn = sortOrder === 'asc' ? asc : desc;

    const stockProducts = await db
      .select({
        lwin18: wmsStock.lwin18,
        productName: sql<string>`MAX(${wmsStock.productName})`,
        producer: sql<string | null>`MAX(${wmsStock.producer})`,
        vintage: sql<number | null>`MAX(${wmsStock.vintage})`,
        bottleSize: sql<string | null>`MAX(${wmsStock.bottleSize})`,
        caseConfig: wmsStock.caseConfig,
        availableCases: sql<number>`SUM(${wmsStock.availableCases})::int`,
        category: sql<string | null>`MAX(${wmsStock.category})`,
      })
      .from(wmsStock)
      .where(and(...conditions))
      .groupBy(wmsStock.lwin18, wmsStock.caseConfig)
      .orderBy(orderFn(orderExpr))
      .limit(limitParam)
      .offset(offsetParam);

    // Get region data from products table for each unique lwin18
    const lwin18s = [...new Set(stockProducts.map((p) => p.lwin18))];
    const productDetails =
      lwin18s.length > 0
        ? await db
            .select({
              lwin18: products.lwin18,
              region: products.region,
              country: products.country,
              imageUrl: products.imageUrl,
            })
            .from(products)
            .where(sql`${products.lwin18} IN ${lwin18s}`)
        : [];

    const detailsMap = new Map(
      productDetails.map((p) => [p.lwin18, p]),
    );

    // Count total for pagination
    const [countResult] = await db
      .select({
        count:
          sql<number>`COUNT(DISTINCT (${wmsStock.lwin18} || '-' || COALESCE(${wmsStock.caseConfig}::text, '0')))::int`,
      })
      .from(wmsStock)
      .where(and(...conditions));

    const totalCount = countResult?.count ?? 0;

    const responseProducts = stockProducts.map((p) => {
      const details = detailsMap.get(p.lwin18);
      return {
        lwin18: p.lwin18,
        productName: p.productName,
        producer: p.producer,
        vintage: p.vintage,
        bottleSize: p.bottleSize,
        caseConfig: p.caseConfig,
        availableCases: p.availableCases,
        totalBottles: p.availableCases * (p.caseConfig ?? 1),
        category: p.category,
        region: details?.region ?? null,
        country: details?.country ?? null,
        imageUrl: details?.imageUrl ?? null,
      };
    });

    return NextResponse.json(
      {
        products: responseProducts,
        pagination: {
          total: totalCount,
          limit: limitParam,
          offset: offsetParam,
          hasMore: offsetParam + stockProducts.length < totalCount,
        },
        updatedAt: new Date().toISOString(),
      },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error('Error fetching pre-order stock:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
};
