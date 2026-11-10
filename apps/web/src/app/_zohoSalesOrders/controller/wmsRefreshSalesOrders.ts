/**
 * Refresh named sales orders from Zoho, for the warehouse
 *
 * The scanner's Re-sync pulls its own order before rebuilding the pick. It
 * went through the full sync, which is admin-only, so on the warehouse login
 * the pull was always refused and the screen said Zoho could not be reached.
 * Reading one order back from Zoho changes nothing but our copy of it, so the
 * warehouse may do it; the sweep of every order stays with admins.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import refreshNamedSalesOrders from '@/app/_zohoSalesOrders/data/refreshNamedSalesOrders';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';

const wmsRefreshSalesOrders = wmsOperatorProcedure
  .input(z.object({ orderNumbers: z.array(z.string()).min(1).max(5) }))
  .mutation(async ({ input }) => {
    if (!isZohoConfigured()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Zoho integration not configured',
      });
    }

    return refreshNamedSalesOrders(input.orderNumbers);
  });

export default wmsRefreshSalesOrders;
