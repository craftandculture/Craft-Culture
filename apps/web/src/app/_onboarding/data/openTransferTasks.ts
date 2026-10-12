import { inArray } from 'drizzle-orm';

import announceTask from '@/app/_teamTasks/data/announceTask';
import logTaskEvent from '@/app/_teamTasks/data/logTaskEvent';
import resolveArea from '@/app/_teamTasks/data/resolveArea';
import writeParts from '@/app/_teamTasks/data/writeParts';
import dubaiToday from '@/app/_teamTasks/utils/dubaiToday';
import db from '@/database/client';
import { type CellarIntake, teamTasks, users } from '@/database/schema';
import logger from '@/utils/logger';

import cellarTeamEmails from '../constants/cellarTeamEmails';
import wineSources from '../constants/wineSources';

interface OpenTransferTasksParams {
  memberName: string;
  partnerId: string;
  intakes: CellarIntake[];
}

/**
 * Open a Team Tasks job for each wine source a new member needs help with
 *
 * One job per source, owned by Kevin with a part for Laraine — moving a cellar
 * in is several weeks of chasing, and a job per source keeps each one visible
 * until it is in. "Starting fresh" needs no job. Never throws: approving the
 * member matters more than the reminder.
 *
 * @returns How many jobs were opened
 */
const openTransferTasks = async ({ memberName, partnerId, intakes }: OpenTransferTasksParams) => {
  const work = intakes.filter((intake) => intake.source !== 'starting_fresh');
  if (!work.length) return 0;

  try {
    const people = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.email, [...cellarTeamEmails]));
    if (!people.length) return 0;

    const today = dubaiToday();
    let opened = 0;

    for (const intake of work) {
      const source = wineSources.find((item) => item.value === intake.source);
      const holder = intake.holderName ? ` (${intake.holderName})` : '';
      const size = intake.approxCases ? `, about ${intake.approxCases} cases` : '';

      const title =
        intake.source === 'uae_in_bond'
          ? `${memberName} — build cellar from UAE in-bond stock`
          : intake.source === 'with_cc'
            ? `${memberName} — link wine already with us`
            : `${memberName} — help transfer wine in${holder}`;

      const what = [`${source?.label ?? intake.source}${holder}${size}`, intake.note, intake.tastes && `Likes: ${intake.tastes}`]
        .filter(Boolean)
        .join('. ');

      const taskId = await db.transaction(async (tx) => {
        const areaId = await resolveArea(tx, null, 'Private Cellar');
        const [task] = await tx
          .insert(teamTasks)
          .values({
            title,
            areaId,
            forTag: 'client',
            linkUrl: '/platform/admin/cellar-members?tab=applications',
            linkLabel: memberName,
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

      await logTaskEvent(taskId, null, `Opened when ${memberName}'s cellar was approved (partner ${partnerId})`);
      await announceTask(taskId, 'opened');
      opened += 1;
    }

    return opened;
  } catch (error) {
    logger.error('Could not open transfer tasks for new cellar member', { error, partnerId });
    return 0;
  }
};

export default openTransferTasks;
