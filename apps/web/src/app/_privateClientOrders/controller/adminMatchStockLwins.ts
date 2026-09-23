import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import isUsableLwin18 from '@/app/_lwin/utils/isUsableLwin18';
import db, { client } from '@/database/client';
import { privateClientOrderItems } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import matchStockLwin from '../utils/matchStockLwin';
import { CLAIM } from '../utils/planZohoSalesOrder';
import repairZohoItemCode from '../utils/repairZohoItemCode';
import saleLwin18Of from '../utils/saleLwin18Of';

/**
 * Give an order's lines the LWIN of the stock they will be picked from
 *
 * For lines that arrived without a real code, and for lines coded to a wine the
 * warehouse does not hold in that vintage and size — a code chosen from Liv-ex
 * by hand can differ from the one the stock was received under, and the stock's
 * is the one picking, pricing and Zoho already know. A line whose code is held
 * is left alone. So is a line with no clear match; it is named in the result.
 *
 * Where the order's sales order was already raised under a placeholder, the
 * Zoho item is corrected as well, as when a line is coded by hand.
 *
 * @example
 *   await trpcClient.privateClientOrders.adminMatchStockLwins.mutate({ orderId });
 */
const adminMatchStockLwins = wmsOperatorProcedure
  .input(z.object({ orderId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const order = await db.query.privateClientOrders.findFirst({
      where: { id: input.orderId },
      columns: { id: true, status: true, zohoSalesOrderId: true },
      with: { items: true },
    });

    if (!order) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
    }

    if (['delivered', 'cancelled'].includes(order.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot edit items in a delivered or cancelled order',
      });
    }

    const matched: string[] = [];
    const unmatched: string[] = [];
    const zohoNotes: string[] = [];

    for (const item of order.items) {
      const usable = isUsableLwin18(item.lwin);

      if (usable) {
        const [wine, vintage, , size] = saleLwin18Of(item.lwin!, item.caseConfig).split('-');
        const [held] = await client<{ held: boolean }[]>`
          SELECT EXISTS (
            SELECT 1 FROM wms_stock
            WHERE SPLIT_PART(lwin18, '-', 1) = ${wine ?? ''}
              AND SPLIT_PART(lwin18, '-', 2) = ${vintage ?? ''}
              AND SPLIT_PART(lwin18, '-', 4) = ${size ?? ''}
              AND (quantity_cases > 0 OR open_bottles > 0)
          ) AS held
        `;

        if (held?.held) continue;
      }

      const match = await matchStockLwin(item);

      if (!match) {
        unmatched.push(item.productName);
        continue;
      }

      if (match.lwin18 === item.lwin) continue;

      await db
        .update(privateClientOrderItems)
        .set({
          lwin: match.lwin18,
          producer: item.producer ?? match.producer,
          updatedAt: new Date(),
        })
        .where(eq(privateClientOrderItems.id, item.id));

      matched.push(`${item.productName} → ${match.lwin18}`);

      if (
        !usable &&
        item.lwin &&
        order.zohoSalesOrderId &&
        order.zohoSalesOrderId !== CLAIM
      ) {
        const repair = await repairZohoItemCode(
          order.zohoSalesOrderId,
          saleLwin18Of(item.lwin, item.caseConfig),
          match.lwin18,
        );

        if (repair.status !== 'repaired') zohoNotes.push(repair.message);
      }
    }

    return { matched, unmatched, zohoNotes };
  });

export default adminMatchStockLwins;
