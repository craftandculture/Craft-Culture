import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarUkMoveItems, cellarUkMoves, cellarUkRotations } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import { OPEN_UK_MOVE_STATUSES } from '../constants/ukMoveStatuses';
import notifyUkRotationAssigned from '../data/notifyUkRotationAssigned';

/**
 * Say whose wine a whole LCB delivery is, in one step
 *
 * LCB books every case as its own rotation, so a member's delivery arrives as
 * dozens or hundreds of rotations at once: Jon De Jager's Burns & German
 * delivery on 19 October 2026 was 193. Assigning them one dropdown at a time
 * was the only way, and each one sent the member its own notice.
 *
 * Same rules as assigning one: a rotation on an open UK move cannot be given
 * to someone else, and the member is told once, for everything they were
 * given here.
 *
 * @example
 *   await trpcClient.cellar.admin.assignUkRotations.mutate({
 *     rotations: ['26/0015470', '26/0015357'],
 *     owner: { kind: 'member', partnerId },
 *   });
 */
const adminAssignUkRotations = staffAdminProcedure
  .input(
    z.object({
      rotations: z.array(z.string().min(1).max(60)).min(1).max(1000),
      owner: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('member'), partnerId: z.string().uuid() }),
        z.object({ kind: z.literal('house') }),
        z.object({ kind: z.literal('none') }),
      ]),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const rotations = [...new Set(input.rotations)];
    const newOwner = input.owner.kind === 'member' ? input.owner.partnerId : null;

    const previous = await db
      .select({ rotation: cellarUkRotations.rotation, partnerId: cellarUkRotations.partnerId })
      .from(cellarUkRotations)
      .where(inArray(cellarUkRotations.rotation, rotations));

    const previousOwner = new Map(previous.map((row) => [row.rotation, row.partnerId]));

    const leaving = rotations.filter((rotation) => {
      const owner = previousOwner.get(rotation);
      return !!owner && owner !== newOwner;
    });

    if (leaving.length > 0) {
      const onMove = await db
        .select({ rotation: cellarUkMoveItems.rotation, moveNumber: cellarUkMoves.moveNumber })
        .from(cellarUkMoveItems)
        .innerJoin(cellarUkMoves, eq(cellarUkMoves.id, cellarUkMoveItems.moveId))
        .where(
          and(
            inArray(cellarUkMoveItems.rotation, leaving),
            inArray(cellarUkMoves.status, OPEN_UK_MOVE_STATUSES),
          ),
        )
        .limit(1)
        .catch(() => []);

      if (onMove[0]) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Rotation ${onMove[0].rotation} is on ${onMove[0].moveNumber}, which is still open. Close that move before reassigning the wine. Nothing was changed.`,
        });
      }
    }

    const now = new Date();
    const values = {
      partnerId: newOwner,
      isHouse: input.owner.kind === 'house',
      assignedBy: ctx.user.id,
      assignedAt: now,
      updatedAt: now,
    };

    await db.transaction(async (tx) => {
      for (const rotation of rotations) {
        await tx
          .insert(cellarUkRotations)
          .values({ rotation, ...values })
          .onConflictDoUpdate({ target: cellarUkRotations.rotation, set: values });
      }
    });

    if (newOwner) {
      const given = rotations.filter((rotation) => previousOwner.get(rotation) !== newOwner);
      if (given.length > 0) {
        await notifyUkRotationAssigned({ rotations: given, partnerId: newOwner });
      }
    }

    return { assigned: rotations.length };
  });

export default adminAssignUkRotations;
