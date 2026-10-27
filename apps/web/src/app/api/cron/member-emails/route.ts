import { NextResponse } from 'next/server';

import sendMemberEmails from '@/app/_cellar/data/sendMemberEmails';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Private Cellar member emails, on Vercel's schedule
 *
 * Called every 10 minutes to send what the outbox has due, in the mode the
 * Member Emails switch is set to; while it is off, nothing reaches anyone.
 * Refuses any call without `Authorization: Bearer <CRON_SECRET>`, and every
 * call when the secret is unset.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    return NextResponse.json(await sendMemberEmails());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Member emails failed', { error: message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
