import { NextResponse } from 'next/server';

import sendPaymentAlerts from '@/app/_zohoSalesOrders/data/sendPaymentAlerts';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Payments received to #payments-received, on Vercel's schedule
 *
 * Called every 15 minutes; the Zoho invoice sync runs every 10, so a payment
 * recorded in Zoho reaches Slack within about half an hour. Refuses any call
 * without `Authorization: Bearer <CRON_SECRET>`, and every call when the
 * secret is unset.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    return NextResponse.json(await sendPaymentAlerts());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Payment alerts failed', { error: message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
