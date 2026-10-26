import { and, arrayContains, count, eq, gt } from 'drizzle-orm';

import db from '@/database/client';
import { productUpdates, users } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import isWhatsNewEnabled from '../data/isWhatsNewEnabled';
import audienceForPartnerType from '../utils/audienceForPartnerType';

/**
 * For the dot in a member's menu: whether What's New is on, and how many
 * updates were published since they last opened it
 */
const unseenCount = stockOwnerProcedure.query(async ({ ctx }) => {
  const enabled = await isWhatsNewEnabled();

  if (!enabled) return { enabled, count: 0 };

  const [me] = await db
    .select({ seenAt: users.whatsNewSeenAt })
    .from(users)
    .where(eq(users.id, ctx.user.id))
    .limit(1);

  // Never opened: nothing is new to them yet, and the first visit sets the mark
  if (!me?.seenAt) return { enabled, count: 0 };

  const [row] = await db
    .select({ count: count() })
    .from(productUpdates)
    .where(
      and(
        eq(productUpdates.status, 'published'),
        arrayContains(productUpdates.audiences, [audienceForPartnerType(ctx.partner.type)]),
        gt(productUpdates.publishedAt, me.seenAt),
      ),
    );

  return { enabled, count: row?.count ?? 0 };
});

export default unseenCount;
