import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import replaceMonthSales from '../data/replaceMonthSales';
import parseOutletSalesReport from '../utils/parseOutletSalesReport';

/**
 * Take an outlet's monthly sales into the ledger
 *
 * The report is keyed on the outlet's own code and carries no price and no
 * owner. Both come from our side — the code bridge, the Codes tab and the
 * invoice lines themselves — in `attributeOutletSales`, which the queue's
 * one-click confirm uses too, so a sale is attributed the same way whichever
 * door it came in by.
 *
 * Lines that cannot be tied to a wine are **reported, never dropped**. An
 * owner's statement that quietly omits bottles is worse than one that says
 * twelve could not be attributed, and a month that silently shrinks is the one
 * failure nobody notices.
 *
 * Replaces that month rather than appending. A report re-sent with a
 * correction should correct, not double.
 *
 * @param outletId - Which outlet sent the report
 * @param year - The year it covers; the sheet names only a month
 * @param file - The workbook, base64
 * @returns What was taken, what could not be, and whether it agrees with the sheet
 */
const adminImportOutletSales = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      year: z.number().int().min(2000).max(2100),
      file: z.string().min(1).max(14_000_000, 'File is too large (10 MB limit)'),
      fileName: z.string().max(300).optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const parsed = parseOutletSalesReport(input.file, input.year);

    if (parsed.lines.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'Nothing in that sheet sold anything. Check the month column is the one you meant.',
      });
    }

    /*
      Sales derived from the outlet's stock positions and this report describe
      the same bottles. Taking both would pay the owner twice, so the report is
      refused while any derived window touches this month. (Deriving refuses
      the other way round.)
    */
    const [derived] = await client<{ windows: string | null }[]>`
      SELECT STRING_AGG(DISTINCT m.doc_ref, ', ') AS windows
      FROM cons_movements m
      JOIN cons_arrangements a ON a.id = m.arrangement_id
      WHERE a.outlet_id = ${input.outletId}
        AND m.kind = 'sold'
        AND m.source = 'cd-api-derived'
        AND COALESCE(
              SUBSTRING(m.doc_ref FROM 'Derived (\\d{4}-\\d{2}-\\d{2})')::date,
              m.doc_date
            ) < (${`${parsed.month}-01`}::date + INTERVAL '1 month')
        AND m.doc_date >= ${`${parsed.month}-01`}::date
    `;

    if (derived?.windows) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `Sales for ${parsed.monthLabel} have already been worked out from the stock positions (${derived.windows}). Delete those first so the same bottles are not counted twice.`,
      });
    }

    const result = await replaceMonthSales({
      outletId: input.outletId,
      month: parsed.month,
      lines: parsed.lines,
      docRef: input.fileName ?? `${parsed.monthLabel} sales`,
    });

    return {
      month: parsed.month,
      monthLabel: parsed.monthLabel,
      lines: result.lines,
      bottles: result.bottles,
      /** The sheet's own total, and whether our reading of it agrees */
      declaredBottles: parsed.declaredBottles,
      agrees: parsed.agrees,
      listedUnsold: parsed.counts.noQuantity,
      /** Sold past every invoice line we have for the wine */
      shortBottles: result.shortBottles,
      unattributedBottles: result.unattributedBottles,
      unattributed: result.unattributed,
    };
  });

export default adminImportOutletSales;
