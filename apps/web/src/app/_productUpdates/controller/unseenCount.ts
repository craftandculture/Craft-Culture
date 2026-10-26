import { and, arrayContains, desc, eq, gt } from 'drizzle-orm';

import db from '@/database/client';
import { productUpdates, users } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import isWhatsNewEnabled from '../data/isWhatsNewEnabled';
import audienceForPartnerType from '../utils/audienceForPartnerType';

/** At most this many menu tabs say "New" at once; more reads as noise */
const MAX_NEW_SCREENS = 2;

/**
 * For a member's menu: whether What's New is on, how many updates were
 * published since they last opened it, and which screens those new features
 * reached, so at most two tabs can say "New" where the change lives
 *
 * Only what the member has not yet seen counts. Opening What's New clears the
 * count and the tab marks together.
 */
const unseenCount = stockOwnerProcedure.query(async ({ ctx }) => {
  const enabled = await isWhatsNewEnabled();

  if (!enabled) return { enabled, count: 0, newScreens: [] as string[] };

  const [me] = await db
    .select({ seenAt: users.whatsNewSeenAt })
    .from(users)
    .where(eq(users.id, ctx.user.id))
    .limit(1);

  // Never opened: nothing is new to them yet, and the first visit sets the mark
  if (!me?.seenAt) return { enabled, count: 0, newScreens: [] as string[] };

  const unseen = await db
    .select({ type: productUpdates.type, linkPath: productUpdates.linkPath })
    .from(productUpdates)
    .where(
      and(
        eq(productUpdates.status, 'published'),
        arrayContains(productUpdates.audiences, [audienceForPartnerType(ctx.partner.type)]),
        gt(productUpdates.publishedAt, me.seenAt),
      ),
    )
    .orderBy(desc(productUpdates.createdAt));

  const newScreens = [
    ...new Set(
      unseen.flatMap((row) => (row.type !== 'fix' && row.linkPath ? [row.linkPath] : [])),
    ),
  ].slice(0, MAX_NEW_SCREENS);

  return { enabled, count: unseen.length, newScreens };
});

export default unseenCount;
