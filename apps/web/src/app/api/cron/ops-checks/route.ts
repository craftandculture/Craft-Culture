import { NextResponse } from 'next/server';

import syncOpsJobs from '@/app/_teamTasks/data/syncOpsJobs';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Ops checks to Team Tasks, on Vercel's schedule
 *
 * Called every 15 minutes. Each check keeps one job in step with what it
 * finds; urgent checks post to #tasks at once. Refuses any call without
 * `Authorization: Bearer <CRON_SECRET>`, and every call when the secret is
 * unset.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    return NextResponse.json(await syncOpsJobs());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error('Ops checks failed', { error: message });

    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
