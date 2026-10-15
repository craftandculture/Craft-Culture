import { NextResponse } from 'next/server';

import sendReorderReport from '@/app/_distribution/data/sendReorderReport';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * City Drinks reorder watch, on Vercel's schedule
 *
 * Called at 03:15 UTC (07:15 Dubai), after the 03:00 sales report has pulled
 * the morning's stock. Posts out-of-stock and low wines, with what C&C can
 * send, to the internal reorder channel. Refuses any call without
 * `Authorization: Bearer <CRON_SECRET>`, and every call when the secret is
 * unset.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    return NextResponse.json(await sendReorderReport());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('City Drinks reorder watch failed', { error: message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
