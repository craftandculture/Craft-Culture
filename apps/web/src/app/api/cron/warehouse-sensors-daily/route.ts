import crypto from 'crypto';

import { NextResponse } from 'next/server';

import sendDailySensorSummary from '@/app/_warehouse/data/sendDailySensorSummary';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';

/** Constant-time compare of a bearer token against a secret, both trimmed */
const matches = (token: string, secret: string | undefined) => {
  const a = Buffer.from(token.trim());
  const b = Buffer.from((secret ?? '').trim());
  return b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Cold room daily summary to #warehouse-data
 *
 * Called by Vercel at 03:00 UTC (07:00 Dubai) with CRON_SECRET. Also accepts
 * the warehouse sensor key, so the summary can be sent on demand to test it
 * without sharing the cron secret.
 */
export const GET = async (request: Request) => {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '');

  if (!matches(token, process.env.CRON_SECRET) && !matches(token, process.env.WAREHOUSE_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const text = await sendDailySensorSummary();
    return NextResponse.json({ posted: true, text });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Cold room daily summary failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
