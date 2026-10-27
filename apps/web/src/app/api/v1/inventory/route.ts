import { and, asc, eq, exists, gt, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import db from '@/database/client';
import { productOffers, products } from '@/database/schema';
import logger from '@/utils/logger';

import type { InventoryItem, InventoryListResponse } from './schema';
import { inventoryQuerySchema } from './schema';
import checkRateLimit from '../_middleware/checkRateLimit';
import validateApiKey from '../_middleware/validateApiKey';
import isPartnerFeed from '../_utils/isPartnerFeed';
import logApiRequest from '../_utils/logApiRequest';
import toInventoryOffer from '../_utils/toInventoryOffer';

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
    await logApiRequest({
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
    await logApiRequest({
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
      cursor: searchParams.get('cursor') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      source: searchParams.get('source') ?? undefined,
      inStock: searchParams.get('inStock') ?? undefined,
    });

    if (!queryResult.success) {
      const responseTimeMs = Date.now() - startTime;
      await logApiRequest({
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

    const { cursor, limit, inStock } = queryResult.data;

    /*
      Same rule as the catalogue: a partner-feed key sees one supplier, so
      neither the offer source nor a filter on it (which would disclose the
      source through the results) is available to it.
    */
    const partnerFeed = isPartnerFeed(permissions);
    const source = partnerFeed ? undefined : queryResult.data.source;

    /*
      Filter in the database, then paginate. Filtering a page after LIMIT
      returned short or empty pages while later products still matched.
    */
    const offerConditions = [
      source ? eq(productOffers.source, source) : undefined,
      inStock === true ? gt(productOffers.availableQuantity, 0) : undefined,
    ].filter((condition) => condition !== undefined);

    const productWhere = offerConditions.length
      ? exists(
          db
            .select({ one: sql`1` })
            .from(productOffers)
            .where(and(eq(productOffers.productId, products.id), ...offerConditions)),
        )
      : undefined;

    const [pageRows, [countResult]] = await Promise.all([
      db
        .select({ id: products.id })
        .from(products)
        .where(productWhere)
        .orderBy(asc(products.name), asc(products.id))
        .limit(limit + 1)
        .offset(cursor),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(productWhere),
    ]);
    const totalCount = countResult?.count ?? 0;

    const pageIds = pageRows.slice(0, limit).map((row) => row.id);
    const [pageProducts, pageOffers] = pageIds.length
      ? await Promise.all([
          db.select().from(products).where(inArray(products.id, pageIds)),
          db
            .select()
            .from(productOffers)
            .where(and(inArray(productOffers.productId, pageIds), ...offerConditions))
            .orderBy(asc(productOffers.price)),
        ])
      : [[], []];

    const productById = new Map(pageProducts.map((product) => [product.id, product]));
    const paginatedProducts = pageIds
      .map((id) => productById.get(id))
      .filter((product) => product !== undefined)
      .map((product) => ({
        ...product,
        productOffers: pageOffers.filter((offer) => offer.productId === product.id),
      }));

    const hasMore = pageRows.length > limit;
    const nextCursor = hasMore ? cursor + limit : null;

    // Transform to response format
    const inventoryItems: InventoryItem[] = paginatedProducts.map((product) => ({
      lwin18: product.lwin18,
      name: product.name,
      producer: product.producer,
      region: product.region,
      country: product.country,
      vintage: product.year,
      imageUrl: product.imageUrl,
      offers: product.productOffers.map((offer) => toInventoryOffer(offer, partnerFeed)),
    }));

    const response: InventoryListResponse = {
      data: inventoryItems,
      meta: {
        nextCursor,
        totalCount,
      },
    };

    const responseTimeMs = Date.now() - startTime;
    await logApiRequest({
      request,
      endpoint,
      statusCode: 200,
      responseTimeMs,
      apiKeyId,
      partnerId,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error fetching inventory:', error);
    const responseTimeMs = Date.now() - startTime;
    await logApiRequest({
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
