import { TRPCError } from '@trpc/server';
import { and, eq, like, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsPickListItems, wmsPickLists } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

/**
 * Let the order go short when the rest of a short pick is not in the building
 *
 * A short pick leaves its remainder on the list, and a list cannot be completed
 * with a line unpicked. When the wine genuinely is not there, the picker needs a
 * way out that leaves a record: the remainder line is removed and the list's
 * notes say what was not shipped, so the office can correct the invoice.
 *
 * Only remainder lines can be dropped. An ordinary line still has to be picked,
 * or the list re-synced from the order.
 */
const adminShipShortRemainder = wmsOperatorProcedure
  .input(z.object({ pickListItemId: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    return db.transaction(async (tx) => {
      const [line] = await tx
        .delete(wmsPickListItems)
        .where(
          and(
            eq(wmsPickListItems.id, input.pickListItemId),
            sql`${wmsPickListItems.isPicked} IS NOT TRUE`,
            like(wmsPickListItems.notes, 'Remainder of a short pick%'),
          ),
        )
        .returning();

      if (!line) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only the unpicked remainder of a short pick can be shipped short.',
        });
      }

      const missing =
        line.quantityBottles != null
          ? `${line.quantityBottles} bottle(s)`
          : `${line.quantityCases} case(s)`;
      const note = `Shipped short by ${ctx.user.name ?? ctx.user.email}: ${line.productName}, ${missing} not picked`;

      await tx
        .update(wmsPickLists)
        .set({
          totalItems: sql`GREATEST(${wmsPickLists.totalItems} - 1, 0)`,
          notes: sql`CASE WHEN ${wmsPickLists.notes} IS NULL OR ${wmsPickLists.notes} = '' THEN ${note} ELSE ${wmsPickLists.notes} || E'\n' || ${note} END`,
          updatedAt: new Date(),
        })
        .where(eq(wmsPickLists.id, line.pickListId));

      return { success: true, message: `${missing} of ${line.productName} marked as shipped short` };
    });
  });

export default adminShipShortRemainder;
