import { NextResponse } from 'next/server';

/**
 * GET /api/v1/openapi.json
 *
 * Machine-readable description of the partner API, so an integrator can
 * generate a client or load it into Postman rather than transcribing the docs
 * page by hand — and so the two cannot quietly disagree about a field name.
 *
 * Unauthenticated on purpose: it describes the shape, never the data.
 */
const SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Craft & Culture Partner API',
    version: '1.0.0',
    description:
      'Live availability and trade pricing for everything Craft & Culture holds. ' +
      'Prices are USD, in bond, exclusive of duty, tax and delivery.',
    contact: { email: 'partners@craftculture.xyz' },
  },
  servers: [{ url: 'https://wine.craftculture.xyz/api/v1' }],
  security: [{ bearerAuth: [] }],
  paths: {
    '/catalogue': {
      get: {
        summary: 'Everything we hold, one row per wine',
        description:
          'Landed stock and in-transit stock, merged. Each row carries a status, ' +
          'quantities and the trade price. Returns the whole book — no pagination.',
        parameters: [
          {
            name: 'stock',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['available', 'inbound', 'all'],
              default: 'available',
            },
            description:
              'available = landed only; inbound = in transit only; all = both, merged.',
          },
          {
            name: 'category',
            in: 'query',
            schema: { type: 'string', enum: ['Wine', 'Spirits', 'RTD'] },
          },
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string' },
            description: 'Free text across wine and producer name.',
          },
        ],
        responses: {
          200: {
            description: 'The catalogue',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CatalogueResponse' },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/inventory': {
      get: {
        summary: 'Product reference data with merchant offers',
        parameters: [
          {
            name: 'cursor',
            in: 'query',
            schema: { type: 'integer', default: 0 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
          { name: 'inStock', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          200: { description: 'Products with offers' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/inventory/{lwin18}': {
      get: {
        summary: 'One product by identifier',
        parameters: [
          {
            name: 'lwin18',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'The product' },
          404: { description: 'Not found' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description:
          'Key issued by Craft & Culture, shown once at creation. Keep it server-side.',
      },
    },
    responses: {
      Unauthorized: {
        description: 'Key missing, malformed, revoked or expired',
      },
      RateLimited: {
        description: '60 requests per minute per key exceeded',
        headers: {
          'Retry-After': { schema: { type: 'integer' } },
          'X-RateLimit-Limit': { schema: { type: 'integer' } },
          'X-RateLimit-Remaining': { schema: { type: 'integer' } },
          'X-RateLimit-Reset': { schema: { type: 'string' } },
        },
      },
    },
    schemas: {
      CatalogueResponse: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/CatalogueItem' },
          },
          meta: {
            type: 'object',
            properties: {
              feed: { type: 'string' },
              stock: { type: 'string' },
              totalCount: { type: 'integer' },
            },
          },
        },
      },
      CatalogueItem: {
        type: 'object',
        required: [
          'lwin18',
          'product',
          'status',
          'availableCases',
          'availableBottles',
          'inTransitBottles',
          'pricePerBottle',
          'pricePerCase',
        ],
        properties: {
          lwin18: {
            type: 'string',
            description:
              'Stable identifier — key your catalogue on this, not the name.',
            examples: ['1104653-2020-05-00750'],
          },
          product: { type: 'string' },
          producer: { type: ['string', 'null'] },
          vintage: {
            type: ['integer', 'null'],
            description: 'null for non-vintage',
          },
          region: { type: ['string', 'null'] },
          country: { type: ['string', 'null'] },
          category: { type: ['string', 'null'] },
          owner: {
            type: ['string', 'null'],
            description: 'Always "Craft & Culture" — carries no information.',
          },
          format: { type: 'string', examples: ['6x75cl'] },
          caseConfig: { type: 'integer', description: 'Bottles per case' },
          bottleSize: { type: ['string', 'null'], examples: ['75cl'] },
          status: {
            type: 'string',
            enum: ['available', 'in_transit', 'unavailable'],
          },
          availableCases: { type: 'integer' },
          availableBottles: {
            type: 'integer',
            description:
              'availableCases x caseConfig. Not a separate loose-bottle count — do not add the two.',
          },
          inTransitBottles: {
            type: 'integer',
            description: 'Bought and on the way, not yet landed.',
          },
          pricePerBottle: { type: 'number', description: 'USD, in bond' },
          pricePerCase: { type: 'number', description: 'USD, in bond' },
          eta: {
            type: ['string', 'null'],
            format: 'date-time',
            description:
              'Earliest expected arrival while stock is in transit; null otherwise, and null where no date is confirmed.',
          },
        },
      },
    },
  },
} as const;

export const GET = async () =>
  NextResponse.json(SPEC, {
    headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' },
  });
