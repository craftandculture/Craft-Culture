import { TRPCError } from '@trpc/server';
import { inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarUkHoldings, cellarUkRotations } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import parseLcbStockRow, { LCB_REQUIRED_COLUMNS } from '../utils/parseLcbStockRow';

/**
 * Import LCB's Rotation Stock report for C&C's Burton account
 *
 * The report is the whole account, so it replaces what was held before in one
 * transaction: wine that has left LCB disappears from members' cellars, and
 * nothing is ever half-imported. Rotations are remembered separately, so who
 * each one belongs to survives every import; a rotation seen for the first
 * time arrives unassigned for the team to place.
 *
 * Read in the browser and sent as rows keyed by column header, the same way
 * the other spreadsheet imports here work.
 *
 * @example
 *   await trpcClient.cellar.admin.importUkStock.mutate({ rows });
 */
const adminImportUkStock = staffAdminProcedure
  .input(
    z.object({
      rows: z
        .array(z.record(z.string(), z.union([z.string(), z.number(), z.null()])))
        .min(1, 'The report has no lines')
        .max(5000),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const headers = new Set(input.rows.flatMap((row) => Object.keys(row)));
    const missing = LCB_REQUIRED_COLUMNS.filter((column) => !headers.has(column));

    if (missing.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `This does not look like LCB's Rotation Stock report: no ${missing.join(', ')} column.`,
      });
    }

    const holdings = input.rows
      .map(parseLcbStockRow)
      .filter((holding): holding is NonNullable<typeof holding> => holding !== null);

    if (holdings.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No stock lines were found in the report.',
      });
    }

    const rotations = [...new Set(holdings.map((holding) => holding.rotation))];

    await db.transaction(async (tx) => {
      await tx.delete(cellarUkHoldings);

      await tx.insert(cellarUkHoldings).values(
        holdings.map((holding) => ({ ...holding, importedBy: ctx.user.id })),
      );

      await tx
        .insert(cellarUkRotations)
        .values(rotations.map((rotation) => ({ rotation })))
        .onConflictDoNothing();
    });

    const [unassigned] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cellarUkRotations)
      .where(
        sql`${inArray(cellarUkRotations.rotation, rotations)} AND ${isNull(cellarUkRotations.partnerId)} AND ${cellarUkRotations.isHouse} = false`,
      );

    return {
      lines: holdings.length,
      bottles: holdings.reduce((sum, holding) => sum + holding.totalBottles, 0),
      rotations: rotations.length,
      unassigned: unassigned?.count ?? 0,
    };
  });

export default adminImportUkStock;
