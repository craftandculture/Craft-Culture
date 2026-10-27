import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { productUpdates } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import lintMemberCopy from '../utils/lintMemberCopy';

/**
 * Publish, unpublish or set aside an update
 *
 * Publishing is refused while the copy check finds anything, so wording that
 * breaks the member rules can never reach a member, whatever the screen shows.
 */
const adminSetStatus = staffAdminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      status: z.enum(['draft', 'published', 'skipped']),
    }),
  )
  .mutation(async ({ input }) => {
    const [row] = await db.select().from(productUpdates).where(eq(productUpdates.id, input.id)).limit(1);

    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'That update no longer exists' });

    if (input.status === 'published') {
      const flags = lintMemberCopy(row);
      if (flags.length > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Fix the wording first: ${flags.join('; ')}` });
      }
    }

    await db
      .update(productUpdates)
      .set({
        status: input.status,
        publishedAt: input.status === 'published' ? new Date() : null,
        skippedReason: input.status === 'skipped' ? (row.skippedReason ?? 'Set aside by staff') : row.skippedReason,
      })
      .where(eq(productUpdates.id, input.id));

    return { ok: true };
  });

export default adminSetStatus;
