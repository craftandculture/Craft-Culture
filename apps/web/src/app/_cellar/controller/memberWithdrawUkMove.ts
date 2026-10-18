import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarUkMoves } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import { WITHDRAWABLE_UK_MOVE_STATUSES } from '../constants/ukMoveStatuses';
import notifyUkMoveUpdate from '../utils/notifyUkMoveUpdate';

/**
 * A member withdraws a request to move UK wine, before accepting it
 *
 * Once accepted, the export order may already be with LCB, so withdrawing
 * becomes a conversation with the team rather than a button. The update is
 * conditional on the status, so it cannot race an acceptance.
 *
 * @example
 *   await trpcClient.cellar.member.withdrawUkMove.mutate({ moveId });
 */
const memberWithdrawUkMove = stockOwnerProcedure
  .input(z.object({ moveId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const [move] = await db
      .update(cellarUkMoves)
      .set({ status: 'withdrawn', closedAt: new Date() })
      .where(
        and(
          eq(cellarUkMoves.id, input.moveId),
          eq(cellarUkMoves.partnerId, ctx.partner.id),
          inArray(cellarUkMoves.status, WITHDRAWABLE_UK_MOVE_STATUSES),
        ),
      )
      .returning({ id: cellarUkMoves.id, moveNumber: cellarUkMoves.moveNumber });

    if (!move) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'This can no longer be withdrawn here. Contact us and we will help.',
      });
    }

    await notifyUkMoveUpdate({
      event: 'withdrawn',
      partnerId: ctx.partner.id,
      moveId: move.id,
      moveNumber: move.moveNumber,
    });

    return move;
  });

export default memberWithdrawUkMove;
