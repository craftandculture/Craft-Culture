import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  sourceCustomerPos,
  sourceSupplierOrderItems,
  sourceSupplierOrders,
} from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

/**
 * Get a single Supplier Order for the authenticated partner
 *
 * @example
 *   await trpcClient.source.partner.supplierOrders.getOne.query({
 *     id: "uuid-here",
 *   });
 */
const partnerGetOneSupplierOrder = winePartnerProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input, ctx: { partnerId } }) => {
    const { id } = input;

    // Get supplier order - ensure it belongs to this partner
    const [supplierOrder] = await db
      .select({
        id: sourceSupplierOrders.id,
        orderNumber: sourceSupplierOrders.orderNumber,
        customerPoId: sourceSupplierOrders.customerPoId,
        partnerId: sourceSupplierOrders.partnerId,
        status: sourceSupplierOrders.status,
        itemCount: sourceSupplierOrders.itemCount,
        totalAmountUsd: sourceSupplierOrders.totalAmountUsd,
        confirmedAmountUsd: sourceSupplierOrders.confirmedAmountUsd,
        excelFileUrl: sourceSupplierOrders.excelFileUrl,
        sentAt: sourceSupplierOrders.sentAt,
        confirmedAt: sourceSupplierOrders.confirmedAt,
        partnerNotes: sourceSupplierOrders.partnerNotes,
        createdAt: sourceSupplierOrders.createdAt,
      })
      .from(sourceSupplierOrders)
      .where(
        and(
          eq(sourceSupplierOrders.id, id),
          eq(sourceSupplierOrders.partnerId, partnerId),
        ),
      )
      .limit(1);

    if (!supplierOrder) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Supplier order not found',
      });
    }

    // Get customer PO details
    const [customerPo] = await db
      .select({
        id: sourceCustomerPos.id,
        ccPoNumber: sourceCustomerPos.ccPoNumber,
        customerName: sourceCustomerPos.customerName,
        customerCompany: sourceCustomerPos.customerCompany,
      })
      .from(sourceCustomerPos)
      .where(eq(sourceCustomerPos.id, supplierOrder.customerPoId))
      .limit(1);

    // Get order items
    const items = await db
      .select()
      .from(sourceSupplierOrderItems)
      .where(eq(sourceSupplierOrderItems.supplierOrderId, id))
      .orderBy(sourceSupplierOrderItems.sortOrder);

    return {
      ...supplierOrder,
      customerPo,
      items,
    };
  });

export default partnerGetOneSupplierOrder;
