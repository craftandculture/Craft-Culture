import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarUkMoveItems, cellarUkMoves, cellarUkRotations } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import { OPEN_UK_MOVE_STATUSES } from '../constants/ukMoveStatuses';
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

    /*
      A rotation on a member's open move is spoken for: giving it to someone
      else would let the move ship wine that is no longer theirs. Read guarded,
      because the moves tables are newer than this screen.
    */
    const leavesMember =
      !!previous?.partnerId &&
      !(input.owner.kind === 'member' && input.owner.partnerId === previous.partnerId);

    if (leavesMember) {
      const onMove = await db
        .select({ moveNumber: cellarUkMoves.moveNumber })
        .from(cellarUkMoveItems)
        .innerJoin(cellarUkMoves, eq(cellarUkMoves.id, cellarUkMoveItems.moveId))
        .where(
          and(
            eq(cellarUkMoveItems.rotation, input.rotation),
            inArray(cellarUkMoves.status, OPEN_UK_MOVE_STATUSES),
          ),
        )
        .limit(1)
        .catch(() => []);

      if (onMove[0]) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `This rotation is on ${onMove[0].moveNumber}, which is still open. Close that move before reassigning the wine.`,
        });
      }
    }

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
