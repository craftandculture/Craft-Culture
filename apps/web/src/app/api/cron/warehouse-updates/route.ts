import { NextResponse } from 'next/server';

import sendWarehouseSummaries from '@/app/_warehouseUpdates/data/sendWarehouseSummaries';
import sendWarehouseUpdates from '@/app/_warehouseUpdates/data/sendWarehouseUpdates';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Warehouse updates to distributors, on Vercel's schedule
 *
 * Called every 5 minutes: sends the picked & packed, ready for dispatch and
 * problem emails that are due, and between 17:00 and 20:00 Gulf time each
 * distributor's end-of-day summary, in the mode the Order Emails switch is
 * set to. Refuses any call without `Authorization: Bearer <CRON_SECRET>`.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const updates = await sendWarehouseUpdates();
    const summaries = await sendWarehouseSummaries();
    return NextResponse.json({ updates, summaries });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Warehouse updates failed', { error: message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
