import { NextResponse } from 'next/server';

import draftPendingUpdates from '@/app/_productUpdates/data/draftPendingUpdates';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * What's New drafting, on Vercel's schedule
 *
 * Reads the changelog items this build carries that the AI has not read yet,
 * and saves drafts for staff to review. Never publishes. Runs hourly, so the
 * drafts for a release are waiting within the hour of it deploying; with
 * nothing new it is one small query.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    return NextResponse.json(await draftPendingUpdates());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error('What’s New drafting failed', { error: message });

    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
