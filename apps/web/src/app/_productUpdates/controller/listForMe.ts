import { and, arrayContains, desc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { productUpdates, users } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import isWhatsNewEnabled from '../data/isWhatsNewEnabled';
import audienceForPartnerType from '../utils/audienceForPartnerType';

/**
 * The published updates for the signed-in member, newest first
 *
 * `seenAt` is when they last opened the page, so the page can mark what is
 * new; it is read before the visit is recorded. Nobody has seen anything yet
 * on a first visit, and nothing is marked new then either, so no member opens
 * the page to a wall of New badges.
 */
const listForMe = stockOwnerProcedure.query(async ({ ctx }) => {
  const audience = audienceForPartnerType(ctx.partner.type);

  const [enabled, [me], rows] = await Promise.all([
    isWhatsNewEnabled(),
    db.select({ seenAt: users.whatsNewSeenAt }).from(users).where(eq(users.id, ctx.user.id)).limit(1),
    db
      .select({
        id: productUpdates.id,
        type: productUpdates.type,
        title: productUpdates.title,
        body: productUpdates.body,
        linkPath: productUpdates.linkPath,
        date: productUpdates.createdAt,
        publishedAt: productUpdates.publishedAt,
      })
      .from(productUpdates)
      .where(
        and(
          eq(productUpdates.status, 'published'),
          arrayContains(productUpdates.audiences, [audience]),
        ),
      )
      .orderBy(desc(productUpdates.createdAt), desc(productUpdates.publishedAt)),
  ]);

  // While What's New is switched off, members are shown nothing at all
  return { enabled, seenAt: me?.seenAt ?? null, updates: enabled ? rows : [] };
});

export default listForMe;
