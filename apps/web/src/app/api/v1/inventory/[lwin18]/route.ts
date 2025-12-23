import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import db from '@/database/client';
import { productOffers, products } from '@/database/schema';

import checkRateLimit from '../../_middleware/checkRateLimit';
import validateApiKey from '../../_middleware/validateApiKey';
import logApiRequest from '../../_utils/logApiRequest';
import type { InventoryItem } from '../schema';

interface RouteParams {
  params: Promise<{ lwin18: string }>;
}

/**
 * GET /api/v1/inventory/:lwin18
 *
 * Returns a single product by LWIN18
 *
 * @example
 *   GET /api/v1/inventory/123456789012345678
 *   Authorization: Bearer cc_live_xxxxxxxxxxxxxxxx
 */
export const GET = async (request: NextRequest, { params }: RouteParams) => {
  const startTime = Date.now();
  const { lwin18 } = await params;
  const endpoint = `/api/v1/inventory/${lwin18}`;

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
    // Validate LWIN18 format (alphanumeric only)
    if (!/^[a-zA-Z0-9]+$/.test(lwin18)) {
      const responseTimeMs = Date.now() - startTime;
      void logApiRequest({
        request,
        endpoint,
        statusCode: 400,
        responseTimeMs,
        apiKeyId,
        partnerId,
        errorMessage: 'Invalid LWIN18 format',
      });
      return NextResponse.json(
        { error: 'Invalid LWIN18 format' },
        { status: 400 },
      );
    }

    // Fetch product
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.lwin18, lwin18))
      .limit(1);

    if (!product) {
      const responseTimeMs = Date.now() - startTime;
      void logApiRequest({
        request,
        endpoint,
        statusCode: 404,
        responseTimeMs,
        apiKeyId,
        partnerId,
        errorMessage: 'Product not found',
      });
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Fetch offers for this product
    const offers = await db
      .select()
      .from(productOffers)
      .where(eq(productOffers.productId, product.id));

    // Transform to response format
    const inventoryItem: InventoryItem = {
      lwin18: product.lwin18,
      name: product.name,
      producer: product.producer,
      region: product.region,
      country: product.country,
      vintage: product.year,
      imageUrl: product.imageUrl,
      offers: offers.map((offer) => ({
        id: offer.id,
        source: offer.source,
        price: offer.price,
        currency: offer.currency,
        unitCount: offer.unitCount,
        unitSize: offer.unitSize,
        availableQuantity: offer.availableQuantity,
        inStock: offer.availableQuantity > 0,
      })),
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

    return NextResponse.json({ data: inventoryItem });
  } catch (error) {
    console.error('Error fetching product:', error);
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
