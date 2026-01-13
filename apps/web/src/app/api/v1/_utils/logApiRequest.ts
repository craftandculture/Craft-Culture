import type { NextRequest } from 'next/server';

import db from '@/database/client';
import { partnerApiRequestLogs } from '@/database/schema';
import logger from '@/utils/logger';

interface LogApiRequestParams {
  request: NextRequest;
  endpoint: string;
  statusCode: number;
  responseTimeMs: number;
  apiKeyId?: string;
  partnerId?: string;
  errorMessage?: string;
}

/**
 * Logs an API request to the database for audit and analytics
 *
 * This function is fire-and-forget - it won't block the response
 */
const logApiRequest = async ({
  request,
  endpoint,
  statusCode,
  responseTimeMs,
  apiKeyId,
  partnerId,
  errorMessage,
}: LogApiRequestParams): Promise<void> => {
  try {
    await db.insert(partnerApiRequestLogs).values({
      apiKeyId: apiKeyId ?? null,
      partnerId: partnerId ?? null,
      endpoint,
      method: request.method,
      statusCode,
      responseTimeMs,
      ipAddress: request.headers.get('x-forwarded-for') ?? null,
      userAgent: request.headers.get('user-agent') ?? null,
      errorMessage: errorMessage ?? null,
    });
  } catch (error) {
    logger.error('Failed to log API request:', error);
  }
};

export default logApiRequest;
