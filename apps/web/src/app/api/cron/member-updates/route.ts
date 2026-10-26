import { NextResponse } from 'next/server';

import autoPublishDrafts from '@/app/_productUpdates/data/autoPublishDrafts';
import draftPendingUpdates from '@/app/_productUpdates/data/draftPendingUpdates';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * What's New drafting, on Vercel's schedule
 *
 * Publishes the AI drafts that have waited a day and pass the copy check,
 * then reads the changelog items this build carries that the AI has not read
 * yet. Runs hourly, so a release is drafted within the hour of deploying and
 * reaches members a day later unless staff stop it.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    // Publish yesterday's drafts first, so a slow drafting run never delays them
    const published = await autoPublishDrafts();
    const drafted = await draftPendingUpdates();

    return NextResponse.json({ ...published, ...drafted });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error('What’s New drafting failed', { error: message });

    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
