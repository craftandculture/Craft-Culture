import { and, eq, like } from 'drizzle-orm';

import logTaskEvent from '@/app/_teamTasks/data/logTaskEvent';
import db from '@/database/client';
import { teamTasks } from '@/database/schema';
import logger from '@/utils/logger';

/** Where the invoice job for a UK move points; set by memberAcceptUkMove */
export const UK_MOVE_TASK_LINK = '/platform/admin/cellar-members?tab=uk-moves';

/**
 * Close the "invoice this UK move" job when the move is cancelled
 *
 * Accepting a UK move opens a Team Tasks job to invoice it. Cancelling the move
 * afterwards left that job open, so the member could have been billed for a
 * move that never happened. The job carries no move id, so it is found by its
 * link and the move number in its title. Never throws: the cancellation stands
 * whether or not the job could be closed.
 *
 * @param moveNumber - UKM-2026-0004
 * @param userId - Who cancelled the move
 */
const cancelUkMoveInvoiceTask = async (moveNumber: string, userId: string) => {
  try {
    const closed = await db
      .update(teamTasks)
      .set({ status: 'cancelled', closedAt: new Date(), closedBy: userId })
      .where(
        and(
          eq(teamTasks.status, 'open'),
          eq(teamTasks.linkUrl, UK_MOVE_TASK_LINK),
          like(teamTasks.title, `%invoice ${moveNumber} (%`),
        ),
      )
      .returning({ id: teamTasks.id });

    for (const task of closed) {
      await logTaskEvent(
        task.id,
        userId,
        `Cancelled: ${moveNumber} was cancelled, so there is nothing to invoice`,
      );
    }
  } catch (error) {
    logger.error('Could not close the invoice job for a cancelled UK move', {
      moveNumber,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export default cancelUkMoveInvoiceTask;
