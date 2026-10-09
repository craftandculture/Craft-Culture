import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { teamTaskAttachments, teamTasks } from '@/database/schema';
import { teamProcedure } from '@/lib/trpc/procedures';
import isVercelBlobUrl from '@/utils/isVercelBlobUrl';

import logTaskEvent from '../data/logTaskEvent';

/**
 * Attach a file to a job, once the browser has uploaded it to Blob
 *
 * The file goes straight from the browser to Blob, so its size never meets the
 * 4.5MB request limit; this only records it against the job.
 *
 * @example
 *   await trpcClient.teamTasks.addAttachment.mutate({ taskId, fileUrl, fileName: 'Quote.pdf' });
 */
const addAttachment = teamProcedure
  .input(
    z.object({
      taskId: z.string().uuid(),
      fileUrl: z.string().url(),
      fileName: z.string().trim().min(1).max(300),
      mimeType: z.string().max(200).nullable().optional(),
      fileSize: z.number().int().min(0).nullable().optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!isVercelBlobUrl(input.fileUrl)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unrecognised file location' });
    }

    const [task] = await db.select({ id: teamTasks.id }).from(teamTasks).where(eq(teamTasks.id, input.taskId));
    if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'That job no longer exists' });

    const [row] = await db
      .insert(teamTaskAttachments)
      .values({
        taskId: input.taskId,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        mimeType: input.mimeType ?? null,
        fileSize: input.fileSize ?? null,
        uploadedBy: ctx.user.id,
      })
      .returning({ id: teamTaskAttachments.id });

    await logTaskEvent(input.taskId, ctx.user.id, `${ctx.user.name} attached ${input.fileName}`);

    return { id: row!.id };
  });

export default addAttachment;
