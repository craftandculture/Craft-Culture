import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import db from '@/database/client';
import { productOffers, products } from '@/database/schema';

import type { InventoryItem, InventoryListResponse } from './schema';
import { inventoryQuerySchema } from './schema';
import checkRateLimit from '../_middleware/checkRateLimit';
import validateApiKey from '../_middleware/validateApiKey';
import logApiRequest from '../_utils/logApiRequest';


/**
 * GET /api/v1/inventory
 *
 * Returns inventory list for retail partners
 *
 * @example
 *   GET /api/v1/inventory?limit=50&source=local_inventory&inStock=true
 *   Authorization: Bearer cc_live_xxxxxxxxxxxxxxxx
 */
export const GET = async (request: NextRequest) => {
  const startTime = Date.now();
  const endpoint = '/api/v1/inventory';

  // Validate API key
  const authResult = await validateApiKey(request);

  if (!authResult.success) {
    const responseTimeMs = Date.now() - startTime;
    void logApiRequest({
      request,
      endpoint,
      statusCode: 401,
      responseTimeMs,
      errorMessage: 'Invalid or missing API key',
    });
    return authResult.error;
  }

  const { apiKeyId, partnerId, permissions } = authResult.data;

  // Check permissions
  if (!permissions.includes('read:inventory')) {
    const responseTimeMs = Date.now() - startTime;
    void logApiRequest({
      request,
      endpoint,
      statusCode: 403,
      responseTimeMs,
      apiKeyId,
      partnerId,
      errorMessage: 'Missing read:inventory permission',
    });
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 },
    );
  }

  // Check rate limit (60 requests per minute)
  const rateLimitResult = await checkRateLimit(apiKeyId);
  if (!rateLimitResult.allowed) {
    const responseTimeMs = Date.now() - startTime;
    void logApiRequest({
      request,
      endpoint,
      statusCode: 429,
      responseTimeMs,
      apiKeyId,
      partnerId,
      errorMessage: 'Rate limit exceeded',
    });
    return rateLimitResult.error;
  }

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryResult = inventoryQuerySchema.safeParse({
      cursor: searchParams.get('cursor'),
      limit: searchParams.get('limit'),
      source: searchParams.get('source'),
      inStock: searchParams.get('inStock'),
    });

    if (!queryResult.success) {
      const responseTimeMs = Date.now() - startTime;
      void logApiRequest({
        request,
        endpoint,
        statusCode: 400,
        responseTimeMs,
        apiKeyId,
        partnerId,
        errorMessage: 'Invalid query parameters',
      });
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.issues },
        { status: 400 },
      );
    }

    const { cursor, limit, source, inStock } = queryResult.data;

    // Get products with offers
    const productsWithOffers = await db.query.products.findMany({
      with: {
        productOffers: {
          orderBy: (po, { asc }) => [asc(po.price)],
        },
      },
      limit: limit + 1,
      offset: cursor,
      orderBy: (table, { asc }) => [asc(table.name)],
    });

    // Filter offers based on query params
    const filterOffer = (offer: typeof productOffers.$inferSelect) => {
      if (source && offer.source !== source) return false;
      if (inStock === true && offer.availableQuantity <= 0) return false;
      return true;
    };

    // Filter products and their offers
    const filteredProducts = productsWithOffers
      .map((product) => ({
        ...product,
        productOffers: product.productOffers.filter(filterOffer),
      }))
      .filter((product) => {
        // If filters are applied, only include products with matching offers
        if (source || inStock) {
          return product.productOffers.length > 0;
        }
        return true;
      });

    // Get total count
    let totalCount: number;
    if (source || inStock) {
      // Count products with matching offers using a subquery
      const sourceCondition = source
        ? eq(productOffers.source, source)
        : undefined;
      const stockCondition =
        inStock === true
          ? sql`${productOffers.availableQuantity} > 0`
          : undefined;

      const conditions = [sourceCondition, stockCondition].filter(Boolean);
      const whereClause =
        conditions.length > 0
          ? sql`${sql.join(conditions, sql` AND `)}`
          : undefined;

      const [countResult] = await db
        .select({ count: sql<number>`count(distinct ${products.id})::int` })
        .from(products)
        .innerJoin(productOffers, eq(products.id, productOffers.productId))
        .where(whereClause);
      totalCount = countResult?.count ?? 0;
    } else {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(products);
      totalCount = countResult?.count ?? 0;
    }

    const hasMore = filteredProducts.length > limit;
    const nextCursor = hasMore ? cursor + limit : null;
    const paginatedProducts = filteredProducts.slice(0, limit);

    // Transform to response format
    const inventoryItems: InventoryItem[] = paginatedProducts.map((product) => ({
      lwin18: product.lwin18,
      name: product.name,
      producer: product.producer,
      region: product.region,
      country: product.country,
      vintage: product.year,
      imageUrl: product.imageUrl,
      offers: product.productOffers.map((offer) => ({
        id: offer.id,
        source: offer.source,
        price: offer.price,
        currency: offer.currency,
        unitCount: offer.unitCount,
        unitSize: offer.unitSize,
        availableQuantity: offer.availableQuantity,
        inStock: offer.availableQuantity > 0,
      })),
    }));

    const response: InventoryListResponse = {
      data: inventoryItems,
      meta: {
        nextCursor,
        totalCount,
      },
    };

    const responseTimeMs = Date.now() - startTime;
    void logApiRequest({
      request,
      endpoint,
      statusCode: 200,
      responseTimeMs,
      apiKeyId,
      partnerId,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    const responseTimeMs = Date.now() - startTime;
    void logApiRequest({
      request,
      endpoint,
      statusCode: 500,
      responseTimeMs,
      apiKeyId,
      partnerId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
};
