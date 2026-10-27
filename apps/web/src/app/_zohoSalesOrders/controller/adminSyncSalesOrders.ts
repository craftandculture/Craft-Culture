/**
 * Manual Sync Zoho Sales Orders
 *
 * Triggers an immediate sync of sales orders from Zoho Books.
 * Used when you don't want to wait for the scheduled job.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import syncSalesOrdersFromZoho from '@/app/_zohoSalesOrders/data/syncSalesOrdersFromZoho';
import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';

const syncSalesOrdersSchema = z
  .object({
    /**
     * Re-fetch these orders' details even when Zoho reports them unchanged.
     * Edits to the ITEM master (e.g. correcting a SKU's pack digits) don't bump
     * the sales order's last-modified time, so the normal short-circuit would
     * never pick them up. Scoped to named orders to stay inside Zoho's rate
     * limit — a blanket force would mean one detail request per open order.
     */
    forceRefreshOrderNumbers: z.array(z.string()).max(25).optional(),
  })
  .optional();

const adminSyncSalesOrders = adminProcedure
  .input(syncSalesOrdersSchema)
  .mutation(async ({ input }) => {
    if (!isZohoConfigured()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Zoho integration not configured',
      });
    }

    return syncSalesOrdersFromZoho({
      forceRefreshOrderNumbers: input?.forceRefreshOrderNumbers,
    });
  });

export default adminSyncSalesOrders;
