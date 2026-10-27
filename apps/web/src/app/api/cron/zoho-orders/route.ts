import { NextResponse } from 'next/server';

import syncSalesOrdersFromZoho from '@/app/_zohoSalesOrders/data/syncSalesOrdersFromZoho';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import { isZohoConfigured } from '@/lib/zoho/client';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Zoho sales orders into the warehouse, every 5 minutes
 *
 * The same sync as the Sync Orders button. Ran every 2 minutes on Trigger.dev
 * until that was switched off in October 2026 to save cost.
 *
 * Refuses any call without `Authorization: Bearer <CRON_SECRET>`, and every
 * call when the secret is unset.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  if (!isZohoConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'Zoho not configured' });
  }

  try {
    return NextResponse.json(await syncSalesOrdersFromZoho());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('zoho-orders cron failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
