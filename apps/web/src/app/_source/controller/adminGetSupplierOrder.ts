import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  partners,
  sourceCustomerPos,
  sourceSupplierOrderItems,
  sourceSupplierOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get a single Supplier Order with all details
 *
 * @example
 *   await trpcClient.source.admin.customerPo.getSupplierOrder.query({
 *     id: "uuid-here",
 *   });
 */
const adminGetSupplierOrder = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input }) => {
    const { id } = input;

    // Get supplier order
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
        createdAt: sourceSupplierOrders.createdAt,
        partnerName: partners.businessName,
        partnerEmail: partners.contactEmail,
      })
      .from(sourceSupplierOrders)
      .leftJoin(partners, eq(sourceSupplierOrders.partnerId, partners.id))
      .where(eq(sourceSupplierOrders.id, id))
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
        poNumber: sourceCustomerPos.poNumber,
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

export default adminGetSupplierOrder;
