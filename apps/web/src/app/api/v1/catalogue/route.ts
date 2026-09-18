import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { PARTNER_FEED_PERMISSION } from '@/app/_partners/schemas/createApiKeySchema';
import getCatalogueInboundRows from '@/app/_wms/data/getCatalogueInboundRows';
import getCatalogueRows from '@/app/_wms/data/getCatalogueRows';
import type { CatalogueRow } from '@/app/_wms/data/getCatalogueRows';
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
 * WMS stock, priced with the Pricing Manager's own rates (matches that
 * screen).
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
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 },
    );
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
      stock: searchParams.get('stock') ?? undefined,
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
        {
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { feed, category, ownerId, search, stock } = queryResult.data;

    /*
      A partner feed is what a distributor builds pre-orders on. It shows the
      whole book, but as one supplier: trade pricing only, and every line
      presented as Craft & Culture. Who actually holds a wine, and what a
      private client pays for it, are ours — not a distributor's to read off an
      integration. Enforced here rather than in the query so there is one place
      to check what a key is allowed to see.
    */
    const partnerFeed = permissions.includes(PARTNER_FEED_PERMISSION);

    // A partner cannot slice the book by owner either — that would disclose
    // through the filter what the payload withholds.
    const effectiveOwnerId = partnerFeed ? undefined : ownerId;

    const [landed, inbound] = await Promise.all([
      stock === 'inbound'
        ? Promise.resolve([])
        : getCatalogueRows({ category, ownerId: effectiveOwnerId, search }),
      stock === 'available'
        ? Promise.resolve([])
        : getCatalogueInboundRows({ category, search }),
    ]);

    /*
      One row per wine, carrying both what is on the shelf and what is coming.
      Asked for by an integrating partner: they need to know whether they can
      sell a wine now or are taking an order against a shipment, and a feed that
      answers that in two separate calls makes them reconcile it themselves.
    */
    const merged = new Map<
      string,
      CatalogueRow & { inTransitBottles: number; eta: Date | null }
    >();

    for (const row of landed) {
      merged.set(row.lwin18, { ...row, inTransitBottles: 0, eta: null });
    }

    for (const row of inbound) {
      const held = merged.get(row.lwin18);

      if (held) {
        held.inTransitBottles += row.availableBottles;
        // The soonest arrival is the one a pre-order is promised against.
        if (!held.eta || (row.eta && row.eta < held.eta)) held.eta = row.eta;
        continue;
      }

      merged.set(row.lwin18, {
        ...row,
        availableCases: 0,
        availableBottles: 0,
        inTransitBottles: row.availableBottles,
        eta: row.eta,
      });
    }

    const data: CatalogueResponseItem[] = [...merged.values()].map((r) => {
      const useRetail = feed === 'retail' && !partnerFeed;
      const status =
        r.availableBottles > 0
          ? 'available'
          : r.inTransitBottles > 0
            ? 'in_transit'
            : 'unavailable';

      return {
        lwin18: r.lwin18,
        product: r.product,
        producer: r.producer,
        vintage: r.vintage,
        region: r.region,
        country: r.country,
        category: r.category,
        owner: partnerFeed ? 'Craft & Culture' : r.owner,
        format: `${r.caseConfig}×${r.bottleSize ?? ''}`,
        caseConfig: r.caseConfig,
        bottleSize: r.bottleSize,
        status,
        availableCases: r.availableCases,
        availableBottles: r.availableBottles,
        inTransitBottles: r.inTransitBottles,
        pricePerBottle: useRetail ? r.pcPerBottle : r.ibPerBottle,
        pricePerCase: useRetail ? r.pcPerCase : r.ibPerCase,
        ib: { perBottle: r.ibPerBottle, perCase: r.ibPerCase },
        // Withheld entirely rather than zeroed: a zero reads as a price.
        ...(partnerFeed
          ? {}
          : { pc: { perBottle: r.pcPerBottle, perCase: r.pcPerCase } }),
        // Only meaningful while something is still coming.
        eta: r.inTransitBottles > 0 && r.eta ? r.eta.toISOString() : null,
      };
    });

    const response: CatalogueResponse = {
      data,
      meta: {
        feed: partnerFeed ? 'trade' : feed,
        stock,
        totalCount: data.length,
      },
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
};
