import { NextResponse } from 'next/server';

import sendDeliveryStageNotices from '@/app/_cellar/data/sendDeliveryStageNotices';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Private Cellar delivery updates to members, on Vercel's schedule
 *
 * Called every 10 minutes: a member hears that their wine is picked, packed,
 * collected, out for delivery or delivered within about ten minutes of it
 * happening. Refuses any call without `Authorization: Bearer <CRON_SECRET>`,
 * and every call when the secret is unset.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    return NextResponse.json(await sendDeliveryStageNotices());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Cellar delivery notices failed', { error: message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
