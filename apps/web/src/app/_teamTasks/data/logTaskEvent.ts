import db from '@/database/client';
import { teamTaskEvents } from '@/database/schema';

/**
 * Add a line to a job's history
 *
 * @example
 *   await logTaskEvent(taskId, userId, 'Sophie ticked off: pricing matrix');
 *
 * @param taskId - The job
 * @param userId - Who did it, or null for the system
 * @param text - What happened, in plain words
 */
const logTaskEvent = async (taskId: string, userId: string | null, text: string) => {
  await db.insert(teamTaskEvents).values({ taskId, userId, text });
};

export default logTaskEvent;
