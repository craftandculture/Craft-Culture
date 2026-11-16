import { NextResponse } from 'next/server';

import sendOrderFeed from '@/app/_privateClientOrders/data/sendOrderFeed';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * New private orders and every step they take, to #private-orders, every 5 minutes
 *
 * A failure (Slack refusing a post) returns 500 with the reason so it shows in
 * Vercel's cron log, and the same events are tried again next run. Refuses
 * any call without `Authorization: Bearer <CRON_SECRET>`, and every call when
 * the secret is unset.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    return NextResponse.json(await sendOrderFeed());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Private order feed failed', { error: message });
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 500 });
  }
};
