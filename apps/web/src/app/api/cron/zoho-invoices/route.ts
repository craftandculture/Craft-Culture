import { NextResponse } from 'next/server';

import syncInvoicesFromZoho from '@/app/_zohoSalesOrders/data/syncInvoicesFromZoho';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import { isZohoConfigured } from '@/lib/zoho/client';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Zoho invoices into the warehouse, every 15 minutes
 *
 * The same sync as the Refresh from Zoho buttons. Ran every 10 minutes on
 * Trigger.dev until that was switched off in October 2026. A failure returns
 * 500, so it shows in Vercel's cron log rather than freezing silently.
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
    return NextResponse.json(await syncInvoicesFromZoho());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('zoho-invoices cron failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
