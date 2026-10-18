import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarUkRotations } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import notifyUkRotationAssigned from '../data/notifyUkRotationAssigned';

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
      await notifyUkRotationAssigned({
        rotation: input.rotation,
        partnerId: input.owner.partnerId,
      });
    }

    return { rotation: input.rotation };
  });

export default adminAssignUkRotation;
