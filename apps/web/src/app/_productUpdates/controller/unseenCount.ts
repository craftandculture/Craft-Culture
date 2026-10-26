import { and, arrayContains, count, eq, gt, gte, inArray, isNotNull } from 'drizzle-orm';

import db from '@/database/client';
import { productUpdates, users } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import isWhatsNewEnabled from '../data/isWhatsNewEnabled';
import audienceForPartnerType from '../utils/audienceForPartnerType';

/** How long a screen carries "New" in the menu after a feature reaches it */
const NEW_IN_MENU_DAYS = 14;

/**
 * For a member's menu: whether What's New is on, how many updates were
 * published since they last opened it, and which screens gained a feature or
 * improvement recently, so those tabs can say "New" where the change lives
 */
const unseenCount = stockOwnerProcedure.query(async ({ ctx }) => {
  const enabled = await isWhatsNewEnabled();

  if (!enabled) return { enabled, count: 0, newScreens: [] as string[] };

  const audience = audienceForPartnerType(ctx.partner.type);
  const since = new Date(Date.now() - NEW_IN_MENU_DAYS * 86_400_000);

  const [[me], screens] = await Promise.all([
    db.select({ seenAt: users.whatsNewSeenAt }).from(users).where(eq(users.id, ctx.user.id)).limit(1),
    db
      .selectDistinct({ linkPath: productUpdates.linkPath })
      .from(productUpdates)
      .where(
        and(
          eq(productUpdates.status, 'published'),
          arrayContains(productUpdates.audiences, [audience]),
          inArray(productUpdates.type, ['feature', 'improvement']),
          isNotNull(productUpdates.linkPath),
          gte(productUpdates.createdAt, since),
        ),
      ),
  ]);

  const newScreens = screens.flatMap((row) => (row.linkPath ? [row.linkPath] : []));

  // Never opened: nothing is new to them yet, and the first visit sets the mark
  if (!me?.seenAt) return { enabled, count: 0, newScreens };

  const [row] = await db
    .select({ count: count() })
    .from(productUpdates)
    .where(
      and(
        eq(productUpdates.status, 'published'),
        arrayContains(productUpdates.audiences, [audience]),
        gt(productUpdates.publishedAt, me.seenAt),
      ),
    );

  return { enabled, count: row?.count ?? 0, newScreens };
});

export default unseenCount;
