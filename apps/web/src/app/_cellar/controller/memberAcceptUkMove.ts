import { TRPCError } from '@trpc/server';
import { and, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';

import openSourcingTask from '@/app/_cellarSourcing/data/openSourcingTask';
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
        freightUsd: cellarUkMoves.freightUsd,
        lcbChargesUsd: cellarUkMoves.lcbChargesUsd,
        otherUsd: cellarUkMoves.otherUsd,
        otherLabel: cellarUkMoves.otherLabel,
      });

    if (!move) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'This quote has changed or is no longer open. Refresh the page to see the latest.',
      });
    }

    /*
      The member has agreed a price, so someone has to bill it. Without a job
      the move shipped and nobody invoiced it. Opened only after the claim
      above succeeds, which can happen once per move, so a retry never opens a
      second job. Payment is due on receipt.
    */
    const usd = (value: number | null) =>
      `$${(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    await openSourcingTask({
      title: `${ctx.partner.businessName} — invoice ${move.moveNumber} (${usd(move.totalUsd)}, move from LCB Burton to the UAE)`,
      what: [
        `Invoice ${ctx.partner.businessName} ${usd(move.totalUsd)} for ${move.moveNumber}, due on receipt.`,
        `Freight ${usd(move.freightUsd)}; LCB charges ${usd(move.lcbChargesUsd)}`,
        move.otherUsd ? `; ${move.otherLabel || 'other'} ${usd(move.otherUsd)}` : '',
        '.',
      ].join(''),
      memberName: ctx.partner.businessName,
      linkUrl: '/platform/admin/cellar-members?tab=uk-moves',
      openedNote: `Opened when ${ctx.partner.businessName} accepted ${move.moveNumber}`,
    });

    await notifyUkMoveUpdate({
      event: 'accepted',
      partnerId: ctx.partner.id,
      moveId: move.id,
      moveNumber: move.moveNumber,
      totalUsd: move.totalUsd,
    });

    /* The breakdown is for the team; the member has only ever seen the total */
    return { id: move.id, moveNumber: move.moveNumber, totalUsd: move.totalUsd };
  });

export default memberAcceptUkMove;
