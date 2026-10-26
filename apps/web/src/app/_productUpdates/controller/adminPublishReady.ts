import { eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { productUpdates } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import lintMemberCopy from '../utils/lintMemberCopy';

/**
 * Publish every draft that passes the copy check, in one go
 *
 * For the launch backlog, and any time staff have read the drafts and want
 * them live without waiting for the hold. Flagged drafts are left alone.
 */
const adminPublishReady = staffAdminProcedure.mutation(async () => {
  const drafts = await db.select().from(productUpdates).where(eq(productUpdates.status, 'draft'));
  const ready = drafts.filter((row) => lintMemberCopy(row).length === 0).map((row) => row.id);

  if (ready.length > 0) {
    await db
      .update(productUpdates)
      .set({ status: 'published', publishedAt: new Date() })
      .where(inArray(productUpdates.id, ready));
  }

  return { published: ready.length, held: drafts.length - ready.length };
});

export default adminPublishReady;
