import { NextResponse } from 'next/server';

import sendPaymentLog from '@/app/_zohoSalesOrders/data/sendPaymentLog';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Every Zoho payment, received and made, to #payments-log, every 15 minutes
 *
 * Reads Zoho's payment records directly, unlike #payments-received, which
 * infers payments from invoice balances. A failure (Zoho refusing the read,
 * Slack refusing a post) returns 500 with the reason, so it shows in Vercel's
 * cron log. Refuses any call without `Authorization: Bearer <CRON_SECRET>`,
 * and every call when the secret is unset.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    return NextResponse.json(await sendPaymentLog());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Payments log failed', { error: message });
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 500 });
  }
};
