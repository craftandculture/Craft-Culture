import { toNextJsHandler } from 'better-auth/next-js';
import type { NextRequest } from 'next/server';

import auth from '@/lib/better-auth/server';
import logger from '@/utils/logger';

const handler = toNextJsHandler(auth);

export const GET = async (request: NextRequest) => {
  return handler.GET(request);
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
