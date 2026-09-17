import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { searchItems } from '@/lib/zoho/items';

import planZohoSalesOrder from '../utils/planZohoSalesOrder';

/**
 * What raising the sales order would do, before it does it
 *
 * The confirmation exists for one thing above all: an item code that does not
 * exist yet gets created, and a created code is permanent in a catalogue we
 * share with the accounts. The SKU itself is computed rather than typed, so
 * there is no typo to catch — what there is to catch is a pack recorded wrongly
 * on the line, which reads plainly as "Bruno Clair Vosne-Romanee 2023 (2x75cl)"
 * and not at all as `1025598-2023-02-00750`.
 *
 * Where every code already exists there is nothing to confirm, and the caller
 * is told so rather than being shown a dialog with no question in it.
 *
 * @example
 *   const preview = await trpcClient.privateClientOrders.adminPreviewZohoSalesOrder
 *     .query({ orderId });
 *
 *   preview.needsConfirmation; // false → raise it on the one press
 */
const adminPreviewZohoSalesOrder = adminProcedure
  .input(z.object({ orderId: z.string().uuid() }))
  .query(async ({ input }) => {
    if (!isZohoConfigured()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Zoho is not configured on this environment.',
      });
    }

    const plan = await planZohoSalesOrder(input.orderId);

    if (!plan) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
    }

    /*
      Only asked of Zoho when the plan is otherwise sound. These are a call per
      line against a rate-limited API, and an order that cannot be raised does
      not need to know which of its codes exist.
    */
    const lines =
      plan.blockers.length > 0
        ? plan.lines.map((line) => ({ ...line, willCreate: false }))
        : await (async () => {
            const checked = [];

            for (const line of plan.lines) {
              const found = await searchItems(line.saleLwin18);

              checked.push({
                ...line,
                willCreate: !found.some((row) => row.sku === line.saleLwin18),
              });
            }

            return checked;
          })();

    const toCreate = lines.filter((line) => line.willCreate);

    return {
      ...plan,
      lines,
      toCreate: toCreate.map((line) => line.packName),
      /*
        Nothing new in Zoho and nothing unpriced is a press with no question in
        it. Anything else gets looked at first.
      */
      needsConfirmation: toCreate.length > 0 || plan.unpriced.length > 0,
    };
  });

export default adminPreviewZohoSalesOrder;
