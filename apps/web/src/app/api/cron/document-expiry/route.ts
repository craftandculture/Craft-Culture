import { NextResponse } from 'next/server';

import sendDocumentExpiryAlerts from '@/app/_logistics/data/sendDocumentExpiryAlerts';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Warn before shipment documents expire, daily at 08:00 Dubai
 *
 * Refuses any call without `Authorization: Bearer <CRON_SECRET>`, and every
 * call when the secret is unset.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    return NextResponse.json(await sendDocumentExpiryAlerts());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('document-expiry cron failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
