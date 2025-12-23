import { and, eq, gte, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import db from '@/database/client';
import { partnerApiRequestLogs } from '@/database/schema';

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
 * Check rate limit for an API key using request logs
 *
 * Uses a sliding window algorithm based on logged requests.
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
  const windowStart = new Date(Date.now() - windowMs);
  const resetAt = new Date(Date.now() + windowMs);

  // Count requests in the current window
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(partnerApiRequestLogs)
    .where(
      and(
        eq(partnerApiRequestLogs.apiKeyId, apiKeyId),
        gte(partnerApiRequestLogs.createdAt, windowStart),
      ),
    );

  const requestCount = result?.count ?? 0;
  const remaining = Math.max(0, maxRequests - requestCount - 1);
  const allowed = requestCount < maxRequests;

  if (!allowed) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      error: NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil(windowMs / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(windowMs / 1000)),
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
