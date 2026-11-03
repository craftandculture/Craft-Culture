import { TRPCError } from '@trpc/server';
import { and, eq, inArray, sql } from 'drizzle-orm';

import type db from '@/database/client';
import {
  cellarUkHoldings,
  cellarUkMoveItems,
  cellarUkMoves,
  cellarUkRotations,
  lwinWines,
} from '@/database/schema';

import { OPEN_UK_MOVE_STATUSES } from '../constants/ukMoveStatuses';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The move lines for chosen LCB holdings, checked against the member's open moves
 *
 * Shared by the member's own request and by staff adding a member's UK wine
 * to a shipment, so both take the same whole lines, refuse the same clashes
 * and name the wine the same way. Takes the per-member lock first: a double
 * press, a second tab, or a member and a staff member at once cannot claim the
 * same wine twice.
 *
 * @param tx - The transaction the move is inserted in
 * @param partnerId - The member whose holdings these must be
 * @param holdingIds - The chosen holdings
 * @param casesByHolding - Fewer cases than the line holds, by holding id
 * @returns The move item rows, without their move id
 */
const resolveUkMoveLines = async (
  tx: Tx,
  partnerId: string,
  holdingIds: string[],
  casesByHolding: Record<string, number> = {},
) => {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`uk-move:${partnerId}`}))`);

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
    .innerJoin(cellarUkRotations, eq(cellarUkHoldings.rotation, cellarUkRotations.rotation))
    .where(and(inArray(cellarUkHoldings.id, holdingIds), eq(cellarUkRotations.partnerId, partnerId)));

  /*
    Fewer lines than ids means a new LCB report replaced the snapshot while
    the wine was being chosen, or an id that is not this member's.
  */
  if (lines.length !== holdingIds.length) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'The UK holdings have just been updated. Refresh the page and choose again.',
    });
  }

  const open = await tx
    .select({ rotation: cellarUkMoveItems.rotation, line: cellarUkMoveItems.line })
    .from(cellarUkMoveItems)
    .innerJoin(cellarUkMoves, eq(cellarUkMoves.id, cellarUkMoveItems.moveId))
    .where(and(eq(cellarUkMoves.partnerId, partnerId), inArray(cellarUkMoves.status, OPEN_UK_MOVE_STATUSES)));

  const taken = new Set(open.map((item) => `${item.rotation}:${item.line}`));

  if (lines.some((line) => taken.has(`${line.rotation}:${line.line}`))) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Some of this wine is already on its way to the UAE, or waiting for a quote.',
    });
  }

  for (const line of lines) {
    const wanted = casesByHolding[line.id];
    if (wanted !== undefined && (wanted > line.cases || !line.bottlesPerCase)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'More cases were chosen than are held. Refresh the page and choose again.',
      });
    }
  }

  const lwin7s = [
    ...new Set(lines.map((line) => line.lwin18.slice(0, 7)).filter((code) => /^\d{7}$/.test(code))),
  ];

  const names = lwin7s.length
    ? await tx
        .select({ lwin: lwinWines.lwin, displayName: lwinWines.displayName })
        .from(lwinWines)
        .where(inArray(lwinWines.lwin, lwin7s))
    : [];

  const nameByLwin = new Map(names.map((row) => [row.lwin, row.displayName]));

  return lines.map((line) => {
    const wanted = casesByHolding[line.id];

    return {
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
      ...(wanted !== undefined && wanted < line.cases
        ? { cases: wanted, singles: 0, totalBottles: wanted * (line.bottlesPerCase ?? 1) }
        : { cases: line.cases, singles: line.singles, totalBottles: line.totalBottles }),
    };
  });
};

export default resolveUkMoveLines;
