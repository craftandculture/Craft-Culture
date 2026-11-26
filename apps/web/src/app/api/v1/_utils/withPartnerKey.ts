import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import logger from '@/utils/logger';

import logApiRequest from './logApiRequest';
import PartnerApiBadRequest from './PartnerApiBadRequest';
import checkRateLimit from '../_middleware/checkRateLimit';
import validateApiKey from '../_middleware/validateApiKey';

/** What a handler is given: the request and the partner the key belongs to */
export interface PartnerKeyContext {
  request: NextRequest;
  partnerId: string;
  apiKeyId: string;
  permissions: string[];
}

/**
 * Wrap an `/api/v1` route in key auth, permission, rate limit and logging
 *
 * Every keyed route does the same five things in the same order, and the
 * inventory and catalogue routes each spell them out by hand. A new route
 * written that way is one forgotten line away from answering without a
 * permission check, so the account routes go through this instead.
 *
 * The partner is taken from the key, never from the request: the handler
 * receives `partnerId` and has no way to be asked about anyone else.
 *
 * @example
 *   export const GET = withPartnerKey('/api/v1/account/stock', 'read:own_stock',
 *     async ({ partnerId }) => getPartnerHoldings(partnerId));
 *
 * @param endpoint - The path, as logged
 * @param permission - The permission the key must carry
 * @param handler - Returns the JSON body; throw PartnerApiBadRequest for a 400
 * @returns A Next.js route handler
 */
const withPartnerKey = (
  endpoint: string,
  permission: string,
  handler: (context: PartnerKeyContext) => Promise<unknown>,
) => {
  return async (request: NextRequest) => {
    const startTime = Date.now();
    const elapsed = () => Date.now() - startTime;

    const authResult = await validateApiKey(request);
    if (!authResult.success) {
      void logApiRequest({
        request,
        endpoint,
        statusCode: 401,
        responseTimeMs: elapsed(),
        errorMessage: 'Invalid or missing API key',
      });
      return authResult.error;
    }

    const { apiKeyId, partnerId, permissions } = authResult.data;
    const log = (statusCode: number, errorMessage?: string) =>
      logApiRequest({
        request,
        endpoint,
        statusCode,
        responseTimeMs: elapsed(),
        apiKeyId,
        partnerId,
        errorMessage,
      });

    if (!permissions.includes(permission)) {
      await log(403, `Missing ${permission} permission`);
      return NextResponse.json(
        { error: 'Insufficient permissions', required: permission },
        { status: 403 },
      );
    }

    const rateLimit = await checkRateLimit(apiKeyId);
    if (!rateLimit.allowed) {
      await log(429, 'Rate limit exceeded');
      return rateLimit.error;
    }

    try {
      const body = await handler({ request, partnerId, apiKeyId, permissions });
      await log(200);

      return NextResponse.json(body, {
        headers: {
          // Partner-specific: never let a shared cache hand it to someone else
          'Cache-Control': 'private, no-store',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof PartnerApiBadRequest) {
        await log(400, error.message);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      logger.error(`Partner API ${endpoint} failed`, { error, partnerId });
      await log(500, error instanceof Error ? error.message : 'Unknown error');
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
};

export default withPartnerKey;
