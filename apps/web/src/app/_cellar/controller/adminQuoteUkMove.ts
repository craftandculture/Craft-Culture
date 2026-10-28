import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarUkMoves } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import cancelUkMoveInvoiceTask from '../data/cancelUkMoveInvoiceTask';
import notifyUkMoveUpdate from '../utils/notifyUkMoveUpdate';
import ukMoveTotal from '../utils/ukMoveTotal';

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Price a member's UK move, or close it
 *
 * The parts are kept for the team — freight, LCB's charges and anything else
 * — and the member is shown their sum. LCB's charges are entered and stored at
 * cost; the total recharges them at cost plus 30% (ukMoveTotal). A quote can be revised until the
 * member accepts it; after that the figure is fixed.
 *
 * @example
 *   await trpcClient.cellar.admin.quoteUkMove.mutate({
 *     moveId, outcome: 'quote', freightUsd: 900, lcbChargesUsd: 60,
 *   });
 */
const adminQuoteUkMove = staffAdminProcedure
  .input(
    z.object({
      moveId: z.string().uuid(),
      outcome: z.enum(['quote', 'cancel']),
      freightUsd: z.number().min(0).optional(),
      lcbChargesUsd: z.number().min(0).optional(),
      otherUsd: z.number().min(0).optional(),
      otherLabel: z.string().trim().max(120).optional(),
      /** Shown to the member */
      adminNotes: z.string().trim().max(1000).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    if (input.outcome === 'cancel') {
      const [move] = await db
        .update(cellarUkMoves)
        .set({
          status: 'cancelled',
          closedAt: new Date(),
          adminNotes: input.adminNotes || null,
        })
        .where(
          and(
            eq(cellarUkMoves.id, input.moveId),
            inArray(cellarUkMoves.status, ['submitted', 'quoted', 'accepted']),
          ),
        )
        .returning();

      if (!move) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This move is already shipping or closed.',
        });
      }

      // An accepted move had an invoice job opened for it; nothing to bill now
      await cancelUkMoveInvoiceTask(move.moveNumber, ctx.user.id);

      await notifyUkMoveUpdate({
        event: 'cancelled',
        partnerId: move.partnerId,
        moveId: move.id,
        moveNumber: move.moveNumber,
        adminNotes: move.adminNotes,
      });

      return move;
    }

    if (input.freightUsd === undefined) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Enter the freight cost to send a quote.',
      });
    }

    if ((input.otherUsd ?? 0) > 0 && !input.otherLabel) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Say what the other charge is for.',
      });
    }

    const { totalUsd } = ukMoveTotal({
      freightUsd: input.freightUsd,
      lcbChargesUsd: input.lcbChargesUsd ?? 0,
      otherUsd: input.otherUsd ?? 0,
    });

    const [move] = await db
      .update(cellarUkMoves)
      .set({
        status: 'quoted',
        freightUsd: round(input.freightUsd),
        lcbChargesUsd: round(input.lcbChargesUsd ?? 0),
        otherUsd: input.otherUsd ? round(input.otherUsd) : null,
        otherLabel: input.otherUsd ? input.otherLabel || null : null,
        totalUsd,
        adminNotes: input.adminNotes || null,
        quotedAt: new Date(),
        quotedBy: ctx.user.id,
      })
      .where(
        and(
          eq(cellarUkMoves.id, input.moveId),
          inArray(cellarUkMoves.status, ['submitted', 'quoted']),
        ),
      )
      .returning();

    if (!move) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This move has been accepted, withdrawn or closed, so it cannot be re-quoted.',
      });
    }

    await notifyUkMoveUpdate({
      event: 'quoted',
      partnerId: move.partnerId,
      moveId: move.id,
      moveNumber: move.moveNumber,
      totalUsd,
    });

    return move;
  });

export default adminQuoteUkMove;
