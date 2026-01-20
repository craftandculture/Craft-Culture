import { toNextJsHandler } from 'better-auth/next-js';
import type { NextRequest } from 'next/server';

import auth from '@/lib/better-auth/server';
import logger from '@/utils/logger';

const handler = toNextJsHandler(auth);

/**
 * Wrap GET requests with logging to diagnose Edge browser issues
 */
export const GET = async (request: NextRequest) => {
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  const isEdge = userAgent.toLowerCase().includes('edg');
  const isMagicLink = url.pathname.includes('magic-link');

  if (isMagicLink) {
    logger.info('[Auth] Magic link verification request', {
      pathname: url.pathname,
      isEdge,
      userAgent: userAgent.substring(0, 100),
      cookies: request.headers.get('cookie')?.substring(0, 200) ?? 'none',
      referer: request.headers.get('referer') ?? 'none',
    });
  }

  const response = await handler.GET(request);

  if (isMagicLink) {
    logger.info('[Auth] Magic link verification response', {
      status: response.status,
      isEdge,
      setCookie: response.headers.get('set-cookie')?.substring(0, 200) ?? 'none',
    });
  }

  return response;
};

export const POST = handler.POST;
