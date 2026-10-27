import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

/**
 * Record that the signed-in person has opened What's New
 *
 * A plain protected call rather than a stock-owner one: someone a cellar is
 * shared with as a viewer may not change the cellar, but marking their own
 * page as read changes nothing of anyone else's.
 */
const markSeen = protectedProcedure.mutation(async ({ ctx }) => {
  await db.update(users).set({ whatsNewSeenAt: new Date() }).where(eq(users.id, ctx.user.id));

  return { ok: true };
});

export default markSeen;
