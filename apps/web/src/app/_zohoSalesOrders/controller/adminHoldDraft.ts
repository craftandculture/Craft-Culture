import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import db from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';
import { getSalesOrder, listSalesOrders } from '@/lib/zoho/salesOrders';

import { startDraftHold } from '../data/draftHolds';

/**
 * Hold the wine on a draft sales order while the client finishes it
 *
 * Read live from Zoho by its number. Only drafts: a confirmed order holds its
 * own stock once it syncs. Asking again refreshes the hold.
 *
 * @example
 *   await trpcClient.zohoSalesOrders.holdDraft.mutate({ number: 'SO-00151' });
 */
const adminHoldDraft = adminProcedure
  .input(z.object({ number: z.string().trim().min(2).max(40) }))
  .mutation(async ({ input, ctx }) => {
    const ref = input.number.toUpperCase();
    const { salesOrders } = await listSalesOrders({ salesorderNumber: ref });
    const found = (salesOrders ?? []).find((s) => s.salesorder_number.toUpperCase() === ref);

    if (!found) throw new TRPCError({ code: 'NOT_FOUND', message: `No sales order numbered ${input.number} in Zoho` });
    if (found.status !== 'draft') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${found.salesorder_number} is ${found.status}, not a draft — confirmed orders hold their own stock once synced`,
      });
    }

    const remote = await getSalesOrder(found.salesorder_id);
    const result = await startDraftHold({ db, remote, userId: ctx.user.id });

    return {
      holdId: result.holdId,
      number: remote.salesorder_number,
      casesHeld: result.held,
      short: result.short,
    };
  });

export default adminHoldDraft;
