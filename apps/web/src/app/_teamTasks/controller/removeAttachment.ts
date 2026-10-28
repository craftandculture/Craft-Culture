import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { teamTaskAttachments } from '@/database/schema';
import { deleteStoredFile } from '@/lib/blob/privateFiles';
import { teamProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import logTaskEvent from '../data/logTaskEvent';
import isTaskFileUrl from '../utils/isTaskFileUrl';

/**
 * Remove a file from a job
 *
 * The file is deleted from Blob as well when it sits in the job's own folder;
 * if that fails the job still loses the link, and the stray file is only
 * logged.
 *
 * @example
 *   await trpcClient.teamTasks.removeAttachment.mutate({ attachmentId });
 */
const removeAttachment = teamProcedure
  .input(z.object({ attachmentId: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    const [row] = await db
      .delete(teamTaskAttachments)
      .where(eq(teamTaskAttachments.id, input.attachmentId))
      .returning();

    if (!row) return { removed: false };

    await logTaskEvent(row.taskId, ctx.user.id, `${ctx.user.name} removed ${row.fileName}`);

    // Only a file in this job's own folder is deleted from Blob; anything else
    // the row pointed at is left alone and logged
    if (!isTaskFileUrl(row.fileUrl, row.taskId)) {
      logger.warn('Task attachment outside the job folder was unlinked, not deleted', {
        taskId: row.taskId,
        fileUrl: row.fileUrl,
      });
    } else if (process.env.BLOB_READ_WRITE_TOKEN) {
      await deleteStoredFile(row.fileUrl).catch((error: unknown) =>
        logger.error('Could not delete a task attachment from Blob', { error, fileUrl: row.fileUrl }),
      );
    }

    return { removed: true };
  });

export default removeAttachment;
