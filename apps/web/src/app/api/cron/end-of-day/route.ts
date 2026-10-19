import { NextResponse } from 'next/server';

import sendEndOfDayReport from '@/app/_teamTasks/data/sendEndOfDayReport';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * End-of-day report to #tasks, on Vercel's schedule
 *
 * Called at 14:00 UTC (18:00 Dubai), Monday to Friday. Refuses any call
 * without `Authorization: Bearer <CRON_SECRET>`, and every call when the
 * secret is unset.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    return NextResponse.json(await sendEndOfDayReport());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error('End-of-day report failed', { error: message });

    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
