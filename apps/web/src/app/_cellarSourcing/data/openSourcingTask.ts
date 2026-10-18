import { inArray } from 'drizzle-orm';

import cellarTeamEmails from '@/app/_onboarding/constants/cellarTeamEmails';
import announceTask from '@/app/_teamTasks/data/announceTask';
import logTaskEvent from '@/app/_teamTasks/data/logTaskEvent';
import resolveArea from '@/app/_teamTasks/data/resolveArea';
import writeParts from '@/app/_teamTasks/data/writeParts';
import dubaiToday from '@/app/_teamTasks/utils/dubaiToday';
import db from '@/database/client';
import { teamTasks, users } from '@/database/schema';
import logger from '@/utils/logger';

export interface OpenSourcingTaskParams {
  title: string;
  what: string;
  memberName: string;
  linkUrl: string;
}

/**
 * Open a Team Tasks job to buy wine a member has agreed to
 *
 * A wine we found or allocated that is not already in our UAE warehouse has
 * to be bought, shipped and invoiced by hand. The job on the shared list is
 * what makes sure it is, and that everyone can see it was. Never throws: the
 * member's acceptance stands whether or not the job could be written.
 *
 * @param params - The job's title, what to do and where it is in Index
 * @returns The job id, or null when none could be opened
 */
const openSourcingTask = async ({
  title,
  what,
  memberName,
  linkUrl,
}: OpenSourcingTaskParams) => {
  try {
    const people = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.email, [...cellarTeamEmails]));
    if (!people.length) return null;

    const today = dubaiToday();

    const taskId = await db.transaction(async (tx) => {
      const areaId = await resolveArea(tx, null, 'Private Cellar');
      const [task] = await tx
        .insert(teamTasks)
        .values({
          title,
          areaId,
          forTag: 'client',
          linkUrl,
          linkLabel: memberName,
          partnerId: null,
        })
        .returning({ id: teamTasks.id });
      await writeParts(
        tx,
        task!.id,
        people.map((person) => ({
          ownerId: person.id,
          what,
          due: today,
          waitsForIndex: null,
        })),
      );
      return task!.id;
    });

    await logTaskEvent(
      taskId,
      null,
      `Opened when ${memberName} agreed to a wine we offered`,
    );
    await announceTask(taskId, 'opened');
    return taskId;
  } catch (error) {
    logger.error('Could not open sourcing task', { error, title });
    return null;
  }
};

export default openSourcingTask;
