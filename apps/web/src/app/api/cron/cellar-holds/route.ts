import { NextResponse } from 'next/server';

import expireCellarReservations from '@/app/_cellar/data/expireCellarReservations';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Release Private Cellar holds past their expiry, hourly
 *
 * Refuses any call without `Authorization: Bearer <CRON_SECRET>`, and every
 * call when the secret is unset.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    return NextResponse.json(await expireCellarReservations());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('cellar-holds cron failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
