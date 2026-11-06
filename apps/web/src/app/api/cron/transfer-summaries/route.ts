import { NextResponse } from 'next/server';

import sendTransferSummaries from '@/app/_wms/data/sendTransferSummaries';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily stock transfer summaries, on Vercel's schedule
 *
 * Called at 13:00 UTC (17:00 Gulf) to tell each owner what changed hands on
 * their stock since the last run, in the mode the Order Emails switch is set
 * to. Refuses any call without `Authorization: Bearer <CRON_SECRET>`.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    return NextResponse.json(await sendTransferSummaries());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Transfer summaries failed', { error: message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
