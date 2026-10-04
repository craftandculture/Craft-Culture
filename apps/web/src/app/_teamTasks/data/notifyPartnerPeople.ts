import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { teamTaskParts, teamTasks } from '@/database/schema';

import getPartnerPeople from './getPartnerPeople';

/**
 * Tell the partner people on a shared job that it is waiting for them
 *
 * Partners are not in Slack, so they hear through the Index bell, with a link
 * to their Tasks page.
 *
 * @param taskId - The shared job
 */
const notifyPartnerPeople = async (taskId: string) => {
  const [task] = await db.select().from(teamTasks).where(eq(teamTasks.id, taskId));
  if (!task?.partnerId) return;

  const [parts, people] = await Promise.all([
    db.select().from(teamTaskParts).where(eq(teamTaskParts.taskId, taskId)),
    getPartnerPeople(),
  ]);
  const ours = people.filter((p) => p.partnerId === task.partnerId);

  for (const owner of new Set(parts.filter((p) => !p.done && ours.some((o) => o.id === p.ownerId)).map((p) => p.ownerId))) {
    await createNotification({
      userId: owner,
      type: 'action_required',
      title: 'Craft & Culture shared a job with you',
      message: task.title,
      entityType: 'team_task',
      entityId: task.id,
      actionUrl: '/platform/tasks',
    });
  }
};

export default notifyPartnerPeople;
