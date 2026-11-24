import { NextResponse } from 'next/server';

import accountApiSpec from '@/app/_partnerApi/openapi/accountApiSpec';

/**
 * The Stock API's own OpenAPI description, for wine partners
 *
 * Kept apart from the catalogue spec at /api/v1/openapi.json so each audience
 * is handed only its own integration.
 */
const SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Craft & Culture Stock API',
    version: '1.0.0',
    description:
      'Your own stock held by Craft & Culture: holdings, movements, sales and reservations. ' +
      'Every answer is scoped to the partner the key was issued to.',
    contact: { email: 'partners@craftculture.xyz' },
  },
  servers: [{ url: 'https://wine.craftculture.xyz/api/v1' }],
  security: [{ bearerAuth: [] }],
  paths: accountApiSpec.paths,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Key issued by Craft & Culture with read:own_stock, shown once. Keep it server-side.',
      },
    },
    responses: {
      Unauthorized: { description: 'Key missing, malformed, revoked or expired' },
      RateLimited: {
        description: '60 requests per minute per key exceeded',
        headers: {
          'Retry-After': { schema: { type: 'integer' } },
          'X-RateLimit-Reset': { schema: { type: 'string' } },
        },
      },
    },
    schemas: accountApiSpec.schemas,
  },
};

/**
 * GET /api/v1/account/openapi.json
 *
 * Unauthenticated on purpose: it describes the shape, never the data.
 */
export const GET = async () =>
  NextResponse.json(SPEC, {
    headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' },
  });
