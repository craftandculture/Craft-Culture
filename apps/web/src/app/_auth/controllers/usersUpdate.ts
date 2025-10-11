import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';
import { after } from 'next/server';

import db from '@/database';
import { users } from '@/database/schema';
import updateAttioPerson from '@/lib/attio/data/updateAttioPerson';
import upsertLoopsContact from '@/lib/loops/data/upsertLoopsContact';
import posthog from '@/lib/posthog/server';
import { protectedProcedure } from '@/lib/trpc/procedures';
import serverConfig from '@/server.config';

import updateUserSchema from '../schemas/updateUserSchema';

const usersUpdate = protectedProcedure
  .input(updateUserSchema)
  .mutation(async ({ ctx, input }) => {
    await db
      .update(users)
      .set(input)
      .where(eq(users.id, ctx.user.id))
      .returning();

    posthog.capture({
      event: 'user:updated',
      distinctId: ctx.user.id,
      properties: {
        ...input,
      },
    });

    after(async () => {
      try {
        await Promise.all([
          serverConfig.enableAttioSync
            ? updateAttioPerson({
                attioPersonId: ctx.user.attioPersonId,
                properties: {
                  ...input,
                },
              })
            : Promise.resolve(),
          serverConfig.enableLoopsSync
            ? upsertLoopsContact(ctx.user.email, {
                ...input,
              })
            : Promise.resolve(),
        ]);
      } catch (error) {
        Sentry.captureException(error);
      }
    });
  });

export default usersUpdate;
