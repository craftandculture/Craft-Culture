import { NextResponse } from 'next/server';

import queueOrderEmails from '@/app/_privateClientOrders/data/queueOrderEmails';
import sendOrderEmails from '@/app/_privateClientOrders/data/sendOrderEmails';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Order emails to wine partners and distributors, on Vercel's schedule
 *
 * Called every 5 minutes: reads new order events into the outbox, then sends
 * what is due, in the mode the Order Emails switch is set to. Refuses any call
 * without `Authorization: Bearer <CRON_SECRET>`.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const queued = await queueOrderEmails();
    const sent = await sendOrderEmails();
    return NextResponse.json({ queued, sent });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Order emails failed', { error: message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
