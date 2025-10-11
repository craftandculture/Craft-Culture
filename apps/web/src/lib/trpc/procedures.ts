import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { after } from 'next/server';

import db from '@/database';
import { users } from '@/database/schema';

import { t } from './trpc';

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = t.procedure;

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use
 * this. It verifies the session is valid and guarantees `ctx.session.user` is
 * not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  /**
   * Update the user's last active at if it's older than 5 minutes. We do this
   * every 5 minutes to avoid spamming the database.
   */
  if (
    !ctx.user.lastActiveAt ||
    ctx.user.lastActiveAt < new Date(Date.now() - 1000 * 60 * 5)
  ) {
    after(async () => {
      await db
        .update(users)
        .set({
          lastActiveAt: new Date(),
        })
        .where(eq(users.id, ctx.user!.id));
    });
  }

  return next({
    ctx: {
      user: ctx.user,
    },
  });
});
