import { NextResponse } from 'next/server';

import sendBondReminders from '@/app/_logistics/data/sendBondReminders';
import sendMorningDigests from '@/app/_teamTasks/data/sendMorningDigests';
import sendOverdueAlerts from '@/app/_teamTasks/data/sendOverdueAlerts';
import sendWeeklyRoundUp from '@/app/_teamTasks/data/sendWeeklyRoundUp';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Team Tasks morning run, on Vercel's schedule
 *
 * Called at 03:00 UTC (07:00 Dubai). Every day: tag owners of parts that have
 * just gone overdue, once, and send each person their own list. On Fridays (Dubai), also post the week's round-up.
 * Refuses any call without `Authorization: Bearer <CRON_SECRET>`, and every
 * call when the secret is unset.
 *
 * Movement bonds needing attention are turned into jobs first, so they appear
 * in the same morning's lists. A failure there is logged and never stops the
 * digests.
 */
export const GET = async (request: Request) => {
  const secret = process.env.CRON_SECRET;

  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const bonds = await sendBondReminders().catch((error: unknown) => {
      logger.error('Movement bond reminders failed', { error: error instanceof Error ? error.message : String(error) });
      return { opened: 0, failed: true };
    });
    const overdue = await sendOverdueAlerts();
    const digests = await sendMorningDigests();
    const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', weekday: 'long' }).format(new Date());
    const roundUp = weekday === 'Friday' ? await sendWeeklyRoundUp() : null;

    return NextResponse.json({ bonds, overdue, digests, roundUp });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error('Team Tasks morning run failed', { error: message });

    return NextResponse.json({ error: message }, { status: 500 });
  }
};
