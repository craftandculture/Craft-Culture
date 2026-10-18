import { TRPCError } from '@trpc/server';
import { and, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';

import assertActivated from '@/app/_onboarding/data/assertActivated';
import db from '@/database/client';
import { cellarUkMoves } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import notifyUkMoveUpdate from '../utils/notifyUkMoveUpdate';

/**
 * A member accepts the quote to bring UK wine to the UAE
 *
 * Accepting commits them to the quoted total and tells the team to place the
 * export order. The figure they agreed to is passed back and checked, so a
 * quote revised while the page was open cannot be accepted unseen.
 *
 * @example
 *   await trpcClient.cellar.member.acceptUkMove.mutate({ moveId, totalUsd: 1240 });
 */
const memberAcceptUkMove = stockOwnerProcedure
  .input(
    z.object({
      moveId: z.string().uuid(),
      /** The total the member was shown */
      totalUsd: z.number().min(0),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await assertActivated(ctx.partner.id);

    const [move] = await db
      .update(cellarUkMoves)
      .set({ status: 'accepted', acceptedAt: new Date() })
      .where(
        and(
          eq(cellarUkMoves.id, input.moveId),
          eq(cellarUkMoves.partnerId, ctx.partner.id),
          eq(cellarUkMoves.status, 'quoted'),
          isNotNull(cellarUkMoves.totalUsd),
          eq(cellarUkMoves.totalUsd, input.totalUsd),
        ),
      )
      .returning({
        id: cellarUkMoves.id,
        moveNumber: cellarUkMoves.moveNumber,
        totalUsd: cellarUkMoves.totalUsd,
      });

    if (!move) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'This quote has changed or is no longer open. Refresh the page to see the latest.',
      });
    }

    await notifyUkMoveUpdate({
      event: 'accepted',
      partnerId: ctx.partner.id,
      moveId: move.id,
      moveNumber: move.moveNumber,
      totalUsd: move.totalUsd,
    });

    return move;
  });

export default memberAcceptUkMove;
