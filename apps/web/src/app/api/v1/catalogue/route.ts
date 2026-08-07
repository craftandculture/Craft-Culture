import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import getCatalogueRows from '@/app/_wms/data/getCatalogueRows';
import logger from '@/utils/logger';

import type { CatalogueResponse, CatalogueResponseItem } from './schema';
import { catalogueQuerySchema } from './schema';
import checkRateLimit from '../_middleware/checkRateLimit';
import validateApiKey from '../_middleware/validateApiKey';
import logApiRequest from '../_utils/logApiRequest';

/**
 * GET /api/v1/catalogue
 *
 * Live consumer catalogue for the public portals — availability straight from
 * WMS stock, priced with the Pricing Manager's own rates (matches that screen).
 *
 * @example
 *   GET /api/v1/catalogue?feed=trade&category=Wine
 *   Authorization: Bearer cc_live_xxxxxxxxxxxxxxxx
 */
export const GET = async (request: NextRequest) => {
  const startTime = Date.now();
  const endpoint = '/api/v1/catalogue';

  const authResult = await validateApiKey(request);
  if (!authResult.success) {
    void logApiRequest({
      request,
      endpoint,
      statusCode: 401,
      responseTimeMs: Date.now() - startTime,
      errorMessage: 'Invalid or missing API key',
    });
    return authResult.error;
  }

  const { apiKeyId, partnerId, permissions } = authResult.data;

  if (!permissions.includes('read:inventory')) {
    void logApiRequest({
      request,
      endpoint,
      statusCode: 403,
      responseTimeMs: Date.now() - startTime,
      apiKeyId,
      partnerId,
      errorMessage: 'Missing read:inventory permission',
    });
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const rateLimitResult = await checkRateLimit(apiKeyId);
  if (!rateLimitResult.allowed) {
    void logApiRequest({
      request,
      endpoint,
      statusCode: 429,
      responseTimeMs: Date.now() - startTime,
      apiKeyId,
      partnerId,
      errorMessage: 'Rate limit exceeded',
    });
    return rateLimitResult.error;
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const queryResult = catalogueQuerySchema.safeParse({
      feed: searchParams.get('feed') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      ownerId: searchParams.get('ownerId') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    });

    if (!queryResult.success) {
      void logApiRequest({
        request,
        endpoint,
        statusCode: 400,
        responseTimeMs: Date.now() - startTime,
        apiKeyId,
        partnerId,
        errorMessage: 'Invalid query parameters',
      });
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.issues },
        { status: 400 },
      );
    }

    const { feed, category, ownerId, search } = queryResult.data;

    const rows = await getCatalogueRows({ category, ownerId, search });

    const data: CatalogueResponseItem[] = rows.map((r) => {
      const useRetail = feed === 'retail';
      return {
        lwin18: r.lwin18,
        product: r.product,
        producer: r.producer,
        vintage: r.vintage,
        region: r.region,
        country: r.country,
        category: r.category,
        owner: r.owner,
        format: `${r.caseConfig}×${r.bottleSize ?? ''}`,
        caseConfig: r.caseConfig,
        bottleSize: r.bottleSize,
        availableCases: r.availableCases,
        availableBottles: r.availableBottles,
        pricePerBottle: useRetail ? r.pcPerBottle : r.ibPerBottle,
        pricePerCase: useRetail ? r.pcPerCase : r.ibPerCase,
        ib: { perBottle: r.ibPerBottle, perCase: r.ibPerCase },
        pc: { perBottle: r.pcPerBottle, perCase: r.pcPerCase },
      };
    });

    const response: CatalogueResponse = {
      data,
      meta: { feed, totalCount: data.length },
    };

    void logApiRequest({
      request,
      endpoint,
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
      apiKeyId,
      partnerId,
    });

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' },
    });
  } catch (error) {
    logger.error('Error fetching catalogue:', error);
    void logApiRequest({
      request,
      endpoint,
      statusCode: 500,
      responseTimeMs: Date.now() - startTime,
      apiKeyId,
      partnerId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};
