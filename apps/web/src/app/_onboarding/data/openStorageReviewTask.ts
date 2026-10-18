import { eq, inArray } from 'drizzle-orm';

import announceTask from '@/app/_teamTasks/data/announceTask';
import logTaskEvent from '@/app/_teamTasks/data/logTaskEvent';
import resolveArea from '@/app/_teamTasks/data/resolveArea';
import writeParts from '@/app/_teamTasks/data/writeParts';
import dubaiToday from '@/app/_teamTasks/utils/dubaiToday';
import db from '@/database/client';
import { teamTasks, users } from '@/database/schema';
import logger from '@/utils/logger';

import getStorageCharges from './getStorageCharges';
import cellarTeamEmails from '../constants/cellarTeamEmails';

/**
 * On the 1st, open one job listing the members over their storage allowance
 *
 * Storage is counted at month end, and with membership billed by invoice
 * nothing adds the extra cases unless someone does. This puts the month's
 * list on the shared jobs list on the 1st, counted at that morning's run,
 * which is the closest the daily schedule comes to midnight on the last day.
 *
 * It only opens a job. Nothing is sent to Zoho or to a member: the figures
 * are checked on Cellar members → Storage and invoiced by a person.
 *
 * Once per month: the title carries the month, and a job with that title
 * already on the list means it has been opened.
 *
 * @param now - The moment to judge by
 * @returns Whether a job was opened, and why not if it was not
 */
const openStorageReviewTask = async (now = new Date()) => {
  const today = dubaiToday(now);
  if (!today.endsWith('-01')) return { opened: false, reason: 'not the 1st' };

  /* The month just ended, read from a moment safely inside it */
  const lastMonth = new Date(`${today}T00:00:00+04:00`);
  lastMonth.setUTCDate(lastMonth.getUTCDate() - 2);
  const monthLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    month: 'long',
    year: 'numeric',
  }).format(lastMonth);
  const title = `Private Cellar storage — ${monthLabel} extra cases to invoice`;

  try {
    const [existing] = await db
      .select({ id: teamTasks.id })
      .from(teamTasks)
      .where(eq(teamTasks.title, title))
      .limit(1);
    if (existing) return { opened: false, reason: 'already opened' };

    const over = (await getStorageCharges()).filter(
      (row) => row.status === 'active' && row.extraCases > 0,
    );
    if (!over.length) return { opened: false, reason: 'nobody over allowance' };

    const people = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.email, [...cellarTeamEmails]));
    if (!people.length) return { opened: false, reason: 'no owners' };

    const list = over
      .map(
        (row) =>
          `${row.name}: ${row.cases} cases held, ${row.extraCases} over, AED ${row.extraAed.toLocaleString('en-GB')}`,
      )
      .join('; ');
    const what = `Check the figures on Cellar members → Storage, then add the extra storage to each member's Zoho Books invoice for ${monthLabel}. ${list}.`;

    const taskId = await db.transaction(async (tx) => {
      const areaId = await resolveArea(tx, null, 'Private Cellar');
      const [task] = await tx
        .insert(teamTasks)
        .values({
          title,
          areaId,
          forTag: 'client',
          linkUrl: '/platform/admin/cellar-members?tab=storage',
          linkLabel: 'Storage',
          partnerId: null,
        })
        .returning({ id: teamTasks.id });
      await writeParts(
        tx,
        task!.id,
        people.map((person) => ({ ownerId: person.id, what, due: today, waitsForIndex: null })),
      );
      return task!.id;
    });

    await logTaskEvent(taskId, null, `Opened by the month-end storage count: ${over.length} members over allowance`);
    await announceTask(taskId, 'opened');
    return { opened: true, members: over.length };
  } catch (error) {
    logger.error('Could not open the storage review task', { error });
    return { opened: false, reason: 'failed' };
  }
};

export default openStorageReviewTask;
