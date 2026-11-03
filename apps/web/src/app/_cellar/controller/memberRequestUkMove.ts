import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import assertActivated from '@/app/_onboarding/data/assertActivated';
import db from '@/database/client';
import { cellarUkMoveItems, cellarUkMoves } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import resolveUkMoveLines from '../data/resolveUkMoveLines';
import generateUkMoveNumber from '../utils/generateUkMoveNumber';
import notifyUkMoveUpdate from '../utils/notifyUkMoveUpdate';

const isMoveNumberClash = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;

  const candidate = error as { code?: string; constraint?: string; cause?: unknown };

  if (
    candidate.code === '23505' &&
    String(candidate.constraint ?? '').includes('move_number')
  ) {
    return true;
  }

  return candidate.cause ? isMoveNumberClash(candidate.cause) : false;
};

/**
 * A member asks for wine at LCB Burton to be brought to the UAE
 *
 * Takes whole LCB lines, which is how Vision picks an export order. Nothing
 * moves and nothing is charged here: the team prices it, and the member
 * accepts or withdraws.
 *
 * The lines are resolved from the holdings the member can see, then held
 * against every other open move under a per-member lock, so a double press or
 * a second tab cannot ask for the same wine twice.
 *
 * @example
 *   await trpcClient.cellar.member.requestUkMove.mutate({ holdingIds: [id] });
 */
const memberRequestUkMove = stockOwnerProcedure
  .input(
    z.object({
      holdingIds: z
        .array(z.string().uuid())
        .min(1)
        // A whole UK cellar in one request: LCB books each case as its own rotation
        .max(1000)
        .refine((ids) => new Set(ids).size === ids.length, {
          message: 'A wine was chosen twice',
        }),
      memberNotes: z.string().trim().max(1000).optional(),
      /**
       * Fewer cases than the line holds, by holding id. LCB books most cases as
       * a rotation of their own, but one rotation can hold several; a member
       * moving two of four takes two, and the rest stays at Burton. Whole
       * cases only: a case opened at LCB is handling we quote separately.
       */
      casesByHolding: z.record(z.string().uuid(), z.number().int().min(1)).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const partnerId = ctx.partner.id;

    await assertActivated(partnerId);

    const create = (attempt: number) =>
      db.transaction(async (tx) => {
        const items = await resolveUkMoveLines(tx, partnerId, input.holdingIds, input.casesByHolding);

        const moveNumber = await generateUkMoveNumber(tx, attempt);

        const [move] = await tx
          .insert(cellarUkMoves)
          .values({
            moveNumber,
            partnerId,
            status: 'submitted',
            memberNotes: input.memberNotes || null,
            createdBy: ctx.user.id,
          })
          .returning({ id: cellarUkMoves.id, moveNumber: cellarUkMoves.moveNumber });

        if (!move) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Could not record your request',
          });
        }

        await tx.insert(cellarUkMoveItems).values(items.map((item) => ({ ...item, moveId: move.id })));

        return move;
      });

    let move: Awaited<ReturnType<typeof create>> | undefined;

    for (let attempt = 0; attempt < 3 && !move; attempt += 1) {
      try {
        move = await create(attempt);
      } catch (error) {
        if (!isMoveNumberClash(error) || attempt === 2) throw error;
      }
    }

    if (!move) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not record your request',
      });
    }

    await notifyUkMoveUpdate({
      event: 'submitted',
      partnerId,
      moveId: move.id,
      moveNumber: move.moveNumber,
    });

    return move;
  });

export default memberRequestUkMove;
