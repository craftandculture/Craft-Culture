import { del } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { teamTaskAttachments } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import logTaskEvent from '../data/logTaskEvent';

/**
 * Remove a file from a job
 *
 * The file is deleted from Blob as well; if that fails the job still loses the
 * link, and the stray file is only logged.
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

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      await del(row.fileUrl).catch((error: unknown) =>
        logger.error('Could not delete a task attachment from Blob', { error, fileUrl: row.fileUrl }),
      );
    }

    return { removed: true };
  });

export default removeAttachment;
