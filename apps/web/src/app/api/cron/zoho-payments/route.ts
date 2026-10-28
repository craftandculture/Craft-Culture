import { NextResponse } from 'next/server';

import syncPcoPaymentsFromZoho from '@/app/_privateClientOrders/data/syncPcoPaymentsFromZoho';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * PCO invoice payment status from Zoho, every 4 hours
 *
 * Refuses any call without `Authorization: Bearer <CRON_SECRET>`, and every
 * call when the secret is unset.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    return NextResponse.json(await syncPcoPaymentsFromZoho());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('zoho-payments cron failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
