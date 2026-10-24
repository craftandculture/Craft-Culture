import { TRPCError } from '@trpc/server';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  cellarReleaseRequestItems,
  cellarReleaseRequests,
  privateClientOrders,
  zohoSalesOrders,
} from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import checkReleaseStock from '../data/checkReleaseStock';
import getMemberZohoCustomer from '../data/getMemberZohoCustomer';
import raiseReleaseOrder from '../data/raiseReleaseOrder';

/**
 * Confirm a quoted release on the member's behalf
 *
 * Members often agree a delivery on WhatsApp or by phone, and the team raises
 * the Zoho order there and then. The release stayed open with nothing to
 * accept, because its bottles had already been picked. This confirms it as the
 * member's Accept would, linking the Zoho order that already carries the wine
 * so the quoted clearance and delivery land on one PCO and it is not pushed to
 * Zoho a second time.
 */
const adminConfirmRelease = staffAdminProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      salesOrderNumber: z.string().trim().max(40).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [request] = await db
      .select()
      .from(cellarReleaseRequests)
      .where(eq(cellarReleaseRequests.id, input.requestId))
      .limit(1);

    if (!request) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
    }

    if (
      request.status !== 'under_review' ||
      request.quotedAt === null ||
      request.privateClientOrderId
    ) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'Only a quoted request that has not been accepted can be confirmed.',
      });
    }

    const lines = await db
      .select()
      .from(cellarReleaseRequestItems)
      .where(eq(cellarReleaseRequestItems.requestId, request.id));

    if (lines.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This request has no wines on it.',
      });
    }

    const salesOrderNumber = input.salesOrderNumber || null;

    const checked = await checkReleaseStock({
      request,
      lines,
      zohoContactId: await getMemberZohoCustomer(request.partnerId),
      salesOrderNumber,
      audience: 'staff',
    });

    /*
      A named order is linked even when the wine is still on the shelf — raised
      but not yet picked — or the PCO would be pushed to Zoho a second time.
    */
    let salesOrder = checked.salesOrder;

    if (salesOrderNumber && !salesOrder) {
      const [found] = await db
        .select({
          zohoSalesOrderId: zohoSalesOrders.zohoSalesOrderId,
          salesOrderNumber: zohoSalesOrders.salesOrderNumber,
          linkedOrderId: privateClientOrders.id,
        })
        .from(zohoSalesOrders)
        .leftJoin(
          privateClientOrders,
          eq(
            privateClientOrders.zohoSalesOrderId,
            zohoSalesOrders.zohoSalesOrderId,
          ),
        )
        .where(
          and(
            eq(
              zohoSalesOrders.salesOrderNumber,
              salesOrderNumber.toUpperCase(),
            ),
            sql`NOT EXISTS (
              SELECT 1 FROM ${cellarReleaseRequests}
              WHERE ${cellarReleaseRequests.privateClientOrderId} = ${privateClientOrders.id}
            )`,
          ),
        )
        .limit(1);

      if (!found) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `${salesOrderNumber.toUpperCase()} is not in the Index yet, or its order already carries another release.`,
        });
      }

      salesOrder = found;
    }

    const order = await raiseReleaseOrder({
      request,
      lines,
      confirmedBy: ctx.user.id,
      salesOrder,
    });

    return {
      orderNumber: order.orderNumber,
      salesOrderNumber: salesOrder?.salesOrderNumber ?? null,
    };
  });

export default adminConfirmRelease;
