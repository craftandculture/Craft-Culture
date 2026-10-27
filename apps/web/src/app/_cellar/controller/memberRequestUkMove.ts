import { TRPCError } from '@trpc/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import assertActivated from '@/app/_onboarding/data/assertActivated';
import db from '@/database/client';
import {
  cellarUkHoldings,
  cellarUkMoveItems,
  cellarUkMoves,
  cellarUkRotations,
  lwinWines,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import { OPEN_UK_MOVE_STATUSES } from '../constants/ukMoveStatuses';
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
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${`uk-move:${partnerId}`}))`,
        );

        const lines = await tx
          .select({
            id: cellarUkHoldings.id,
            rotation: cellarUkHoldings.rotation,
            line: cellarUkHoldings.line,
            lwin18: cellarUkHoldings.lwin18,
            brand: cellarUkHoldings.brand,
            description: cellarUkHoldings.description,
            vintage: cellarUkHoldings.vintage,
            bottlesPerCase: cellarUkHoldings.bottlesPerCase,
            bottleSizeLitres: cellarUkHoldings.bottleSizeLitres,
            cases: cellarUkHoldings.cases,
            singles: cellarUkHoldings.singles,
            totalBottles: cellarUkHoldings.totalBottles,
          })
          .from(cellarUkHoldings)
          .innerJoin(
            cellarUkRotations,
            eq(cellarUkHoldings.rotation, cellarUkRotations.rotation),
          )
          .where(
            and(
              inArray(cellarUkHoldings.id, input.holdingIds),
              eq(cellarUkRotations.partnerId, partnerId),
            ),
          );

        /*
          Fewer lines than ids means a new LCB report replaced the snapshot
          while the member was choosing, or an id that is not theirs.
        */
        if (lines.length !== input.holdingIds.length) {
          throw new TRPCError({
            code: 'CONFLICT',
            message:
              'Your UK holdings have just been updated. Refresh the page and choose again.',
          });
        }

        const open = await tx
          .select({
            rotation: cellarUkMoveItems.rotation,
            line: cellarUkMoveItems.line,
          })
          .from(cellarUkMoveItems)
          .innerJoin(cellarUkMoves, eq(cellarUkMoves.id, cellarUkMoveItems.moveId))
          .where(
            and(
              eq(cellarUkMoves.partnerId, partnerId),
              inArray(cellarUkMoves.status, OPEN_UK_MOVE_STATUSES),
            ),
          );

        const taken = new Set(open.map((item) => `${item.rotation}:${item.line}`));

        if (lines.some((line) => taken.has(`${line.rotation}:${line.line}`))) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Some of this wine is already on its way to the UAE, or waiting for a quote.',
          });
        }

        const partial = input.casesByHolding ?? {};
        for (const line of lines) {
          const wanted = partial[line.id];
          if (wanted !== undefined && (wanted > line.cases || !line.bottlesPerCase)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'More cases were chosen than are held. Refresh the page and choose again.',
            });
          }
        }

        const lwin7s = [
          ...new Set(
            lines
              .map((line) => line.lwin18.slice(0, 7))
              .filter((code) => /^\d{7}$/.test(code)),
          ),
        ];

        const names = lwin7s.length
          ? await tx
              .select({ lwin: lwinWines.lwin, displayName: lwinWines.displayName })
              .from(lwinWines)
              .where(inArray(lwinWines.lwin, lwin7s))
          : [];

        const nameByLwin = new Map(names.map((row) => [row.lwin, row.displayName]));

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

        await tx.insert(cellarUkMoveItems).values(
          lines.map((line) => ({
            moveId: move.id,
            rotation: line.rotation,
            line: line.line,
            lwin18: line.lwin18,
            name:
              nameByLwin.get(line.lwin18.slice(0, 7)) ??
              (line.brand && line.brand !== 'NA' ? line.brand : line.description) ??
              'Wine',
            vintage: line.vintage,
            bottlesPerCase: line.bottlesPerCase,
            bottleSizeLitres: line.bottleSizeLitres,
            ...(partial[line.id] !== undefined && partial[line.id]! < line.cases
              ? {
                  cases: partial[line.id]!,
                  singles: 0,
                  totalBottles: partial[line.id]! * (line.bottlesPerCase ?? 1),
                }
              : { cases: line.cases, singles: line.singles, totalBottles: line.totalBottles }),
          })),
        );

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
