import { toNextJsHandler } from 'better-auth/next-js';
import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

import db from '@/database/client';
import { verifications } from '@/database/schema';
import auth from '@/lib/better-auth/server';
import logger from '@/utils/logger';

const handler = toNextJsHandler(auth);

/**
 * Wrap GET requests with logging to diagnose magic link issues
 */
export const GET = async (request: NextRequest) => {
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  const isEdge = userAgent.toLowerCase().includes('edg');
  const isMagicLink = url.pathname.includes('magic-link');

  if (isMagicLink) {
    const token = url.searchParams.get('token');

    // Direct DB check: does the token exist in verifications?
    let dbCheckResult = 'unknown';
    if (token) {
      try {
        const rows = await db
          .select({
            id: verifications.id,
            identifier: verifications.identifier,
            expiresAt: verifications.expiresAt,
          })
          .from(verifications)
          .where(eq(verifications.identifier, token))
          .limit(1);

        if (rows.length > 0) {
          const row = rows[0];
          const isExpired = row.expiresAt < new Date();
          dbCheckResult = `found (id=${row.id}, expired=${isExpired}, expiresAt=${row.expiresAt?.toISOString()})`;
        } else {
          // Also count total verifications
          const allRows = await db
            .select({ id: verifications.id })
            .from(verifications)
            .limit(5);
          dbCheckResult = `NOT_FOUND (total verifications in table: ${allRows.length})`;
        }
      } catch (e) {
        dbCheckResult = `DB_ERROR: ${e instanceof Error ? e.message : 'unknown'}`;
      }
    }

    logger.info('[Auth] Magic link verify request', {
      token: token?.substring(0, 10) + '...',
      dbCheck: dbCheckResult,
      isEdge,
      userAgent: userAgent.substring(0, 100),
    });
  }

  try {
    const response = await handler.GET(request);

    if (isMagicLink) {
      // Clone response to read body without consuming the original
      const cloned = response.clone();
      let body: string | undefined;
      try {
        body = await cloned.text();
      } catch {
        body = '<unreadable>';
      }

      logger.info('[Auth] Magic link verify response', {
        status: response.status,
        location: response.headers.get('location') ?? 'none',
        body: body?.substring(0, 500) ?? 'none',
      });
    }

    return response;
  } catch (error) {
    if (isMagicLink) {
      logger.error('[Auth] Magic link verify THROWN error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
        type: error?.constructor?.name,
      });
    }
    throw error;
  }
};

export const POST = async (request: NextRequest) => {
  const url = new URL(request.url);

  try {
    return await handler.POST(request);
  } catch (error) {
    logger.error('[Auth] Error in POST handler', {
      pathname: url.pathname,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};
