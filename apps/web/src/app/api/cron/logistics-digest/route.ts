import { NextResponse } from 'next/server';

import sendLogisticsDigest from '@/app/_logistics/notifications/sendLogisticsDigest';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Logistics morning digest to #logistics, on Vercel's schedule
 *
 * Called by Vercel Cron at 04:00 UTC (08:00 Dubai), Monday to Friday. Vercel
 * sends `Authorization: Bearer <CRON_SECRET>`; anything else is refused, and so
 * is every call when the secret is not set. When SLACK_LOGISTICS_WEBHOOK_URL is
 * unset, the digest is built, a warning logged, and nothing posted.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const result = await sendLogisticsDigest();

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error('Logistics digest failed', { error: message });

    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
