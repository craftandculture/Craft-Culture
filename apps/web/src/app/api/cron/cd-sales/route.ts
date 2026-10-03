import { NextResponse } from 'next/server';

import sendDailySalesReport from '@/app/_distribution/data/sendDailySalesReport';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily sales to #cd-sales, on Vercel's schedule
 *
 * Called by Vercel Cron at 03:00 UTC (07:00 Dubai), after City Drinks
 * regenerate their feed at 02:00 UTC. Vercel sends `Authorization: Bearer
 * <CRON_SECRET>`; anything else is refused, and so is every call when the
 * secret is not set — fail closed rather than leave a public endpoint that
 * posts to Slack.
 */
export const GET = async (request: Request) => {
  const secret = process.env.CRON_SECRET;

  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const result = await sendDailySalesReport();

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error('Daily sales report failed', { error: message });

    return NextResponse.json({ error: message }, { status: 500 });
  }
};
