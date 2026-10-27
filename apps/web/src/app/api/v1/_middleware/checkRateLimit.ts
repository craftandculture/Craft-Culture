import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import db from '@/database/client';
import { partnerApiRateLimits, partnerApiRequestLogs } from '@/database/schema';
import logger from '@/utils/logger';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60 * 1000, // 1 minute
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  error?: NextResponse;
}

/**
 * Count this request against its key's current window, atomically
 *
 * One INSERT ... ON CONFLICT DO UPDATE ... RETURNING both records the request
 * and reads the new total, so two requests arriving together cannot both see
 * the count below the limit.
 */
const countInWindow = async (apiKeyId: string, windowStart: Date) => {
  const [row] = await db
    .insert(partnerApiRateLimits)
    .values({ apiKeyId, windowStart, requestCount: 1 })
    .onConflictDoUpdate({
      target: [partnerApiRateLimits.apiKeyId, partnerApiRateLimits.windowStart],
      set: { requestCount: sql`${partnerApiRateLimits.requestCount} + 1` },
    })
    .returning({ count: partnerApiRateLimits.requestCount });

  // Now and then, drop windows older than a day so the table stays small
  if (Math.random() < 0.01) {
    void db
      .delete(partnerApiRateLimits)
      .where(lt(partnerApiRateLimits.windowStart, new Date(Date.now() - 864e5)))
      .catch((error: unknown) => logger.warn('API rate limit cleanup failed', { error }));
  }

  return row?.count ?? 1;
};

/**
 * Fallback when the counter table is unavailable: the request logs in the
 * last window, plus this request
 */
const countFromLogs = async (apiKeyId: string, windowMs: number) => {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(partnerApiRequestLogs)
    .where(
      and(
        eq(partnerApiRequestLogs.apiKeyId, apiKeyId),
        gte(
          partnerApiRequestLogs.createdAt,
          sql`NOW() - (${windowMs} * INTERVAL '1 millisecond')`,
        ),
      ),
    );

  return (result?.count ?? 0) + 1;
};

/**
 * Check rate limit for an API key
 *
 * Fixed one-minute windows counted in `partner_api_rate_limits`.
 * Default: 60 requests per minute per API key.
 *
 * @param apiKeyId - The API key ID to check
 * @param config - Optional rate limit configuration
 */
const checkRateLimit = async (
  apiKeyId: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): Promise<RateLimitResult> => {
  const { maxRequests, windowMs } = config;
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const resetAt = new Date(windowStart.getTime() + windowMs);

  let requestCount: number;
  try {
    requestCount = await countInWindow(apiKeyId, windowStart);
  } catch (error) {
    logger.error('API rate limit counter unavailable; falling back to request logs', { error });
    requestCount = await countFromLogs(apiKeyId, windowMs);
  }

  const allowed = requestCount <= maxRequests;
  const remaining = Math.max(0, maxRequests - requestCount);

  if (!allowed) {
    const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      error: NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetAt.toISOString(),
          },
        },
      ),
    };
  }

  return {
    allowed: true,
    remaining,
    resetAt,
  };
};

export default checkRateLimit;
