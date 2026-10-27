import { NextResponse } from 'next/server';

import pullOutletStock from '@/app/_distribution/data/pullOutletStock';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * City Drinks' stock position and PCO bundle SKUs, daily at 06:30 Dubai
 *
 * City Drinks regenerate their feed at 02:00 UTC; this reads it first.
 *
 * Refuses any call without `Authorization: Bearer <CRON_SECRET>`, and every
 * call when the secret is unset.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    return NextResponse.json(await pullOutletStock());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('outlet-stock cron failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
