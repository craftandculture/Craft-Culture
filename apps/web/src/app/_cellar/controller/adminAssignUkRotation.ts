import { eq } from 'drizzle-orm';
import { z } from 'zod';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { cellarUkHoldings, cellarUkRotations } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import getPartnerUserIds from '../data/getPartnerUserIds';

/**
 * Say whose wine an LCB rotation is
 *
 * Remembered against the rotation, so every later report places it the same
 * way. A member given wine is told it is in their cellar at our UK bond;
 * marking it house stock (C&C's own) or clearing it tells nobody.
 *
 * @example
 *   await trpcClient.cellar.admin.assignUkRotation.mutate({ rotation: '26/D014659', owner: { kind: 'member', partnerId } });
 */
const adminAssignUkRotation = staffAdminProcedure
  .input(
    z.object({
      rotation: z.string().min(1).max(60),
      owner: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('member'), partnerId: z.string().uuid() }),
        z.object({ kind: z.literal('house') }),
        z.object({ kind: z.literal('none') }),
      ]),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [previous] = await db
      .select({ partnerId: cellarUkRotations.partnerId })
      .from(cellarUkRotations)
      .where(eq(cellarUkRotations.rotation, input.rotation))
      .limit(1);

    const values = {
      partnerId: input.owner.kind === 'member' ? input.owner.partnerId : null,
      isHouse: input.owner.kind === 'house',
      assignedBy: ctx.user.id,
      assignedAt: new Date(),
      updatedAt: new Date(),
    };

    await db
      .insert(cellarUkRotations)
      .values({ rotation: input.rotation, ...values })
      .onConflictDoUpdate({ target: cellarUkRotations.rotation, set: values });

    if (input.owner.kind === 'member' && previous?.partnerId !== input.owner.partnerId) {
      try {
        const lines = await db
          .select({
            brand: cellarUkHoldings.brand,
            description: cellarUkHoldings.description,
            vintage: cellarUkHoldings.vintage,
            totalBottles: cellarUkHoldings.totalBottles,
          })
          .from(cellarUkHoldings)
          .where(eq(cellarUkHoldings.rotation, input.rotation));

        const bottles = lines.reduce((sum, line) => sum + line.totalBottles, 0);
        const first = lines[0];
        const wine = first
          ? [first.brand && first.brand !== 'NA' ? first.brand : first.description, first.vintage]
              .filter(Boolean)
              .join(' ')
          : 'Your wine';

        for (const userId of await getPartnerUserIds(input.owner.partnerId)) {
          await createNotification({
            userId,
            type: 'cellar_wine_received',
            title: 'Wine received at our UK bond',
            message: `${wine}${lines.length > 1 ? ` and ${lines.length - 1} more` : ''} (${bottles} ${
              bottles === 1 ? 'bottle' : 'bottles'
            }) is now held for you at London City Bond, Burton.`,
            actionUrl: `${serverConfig.appUrl}/platform/cellar`,
          });
        }
      } catch (error) {
        logger.error('Could not notify a UK rotation assignment', { rotation: input.rotation, error });
      }
    }

    return { rotation: input.rotation };
  });

export default adminAssignUkRotation;
