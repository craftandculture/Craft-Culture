import { and, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';

import db from '@/database/client';
import { productUpdates } from '@/database/schema';

import { AUTO_PUBLISH_FROM_DATE, AUTO_PUBLISH_HOLD_HOURS } from '../constants/autoPublish';
import lintMemberCopy from '../utils/lintMemberCopy';

/**
 * Publish the AI drafts that have waited their hold and pass the copy check
 *
 * Only an untouched AI draft (createdBy null) qualifies. Any staff save or
 * status change sets createdBy, so anything staff have edited, unpublished or
 * sent back to draft publishes only when a person publishes it. A row changed
 * at all since it was written (updatedAt past createdAt) is also left alone,
 * which covers items staff touched before createdBy was set on every change.
 * A draft the copy check flags never publishes itself either.
 *
 * @returns How many were published
 */
const autoPublishDrafts = async () => {
  const cutoff = new Date(Date.now() - AUTO_PUBLISH_HOLD_HOURS * 3_600_000);

  const candidates = await db
    .select()
    .from(productUpdates)
    .where(
      and(
        eq(productUpdates.status, 'draft'),
        isNull(productUpdates.createdBy),
        gte(productUpdates.createdAt, new Date(`${AUTO_PUBLISH_FROM_DATE}T00:00:00Z`)),
        lte(productUpdates.updatedAt, cutoff),
        lte(productUpdates.updatedAt, sql`${productUpdates.createdAt} + interval '1 minute'`),
      ),
    );

  const ready = candidates.filter((row) => lintMemberCopy(row).length === 0).map((row) => row.id);

  if (ready.length === 0) return { published: 0 };

  await db
    .update(productUpdates)
    .set({ status: 'published', publishedAt: new Date() })
    .where(and(inArray(productUpdates.id, ready), eq(productUpdates.status, 'draft')));

  return { published: ready.length };
};

export default autoPublishDrafts;
