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

import { exportSupplierOrderToBase64 } from '../utils/exportSupplierOrderToExcel';

/**
 * Export a Supplier Order to Excel
 *
 * @example
 *   const { base64, filename } = await trpcClient.source.admin.customerPo.exportSupplierOrderExcel.query({
 *     id: "uuid-here",
 *   });
 */
const adminExportSupplierOrderExcel = adminProcedure
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
        totalAmountUsd: sourceSupplierOrders.totalAmountUsd,
        createdAt: sourceSupplierOrders.createdAt,
      })
      .from(sourceSupplierOrders)
      .where(eq(sourceSupplierOrders.id, id))
      .limit(1);

    if (!supplierOrder) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Supplier order not found',
      });
    }

    // Get partner details
    const [partner] = await db
      .select({
        businessName: partners.businessName,
      })
      .from(partners)
      .where(eq(partners.id, supplierOrder.partnerId))
      .limit(1);

    // Get customer PO details
    const [customerPo] = await db
      .select({
        ccPoNumber: sourceCustomerPos.ccPoNumber,
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

    // Generate Excel
    const excelData = {
      orderNumber: supplierOrder.orderNumber,
      partnerName: partner?.businessName || 'Unknown Partner',
      customerPoNumber: customerPo?.ccPoNumber,
      customerCompany: customerPo?.customerCompany,
      createdAt: supplierOrder.createdAt,
      items: items.map((item) => ({
        productName: item.productName,
        producer: item.producer,
        vintage: item.vintage,
        lwin7: item.lwin7,
        lwin18: item.lwin18,
        quantityBottles: item.quantityBottles,
        quantityCases: item.quantityCases,
        caseConfig: item.caseConfig,
        costPerBottleUsd: item.costPerBottleUsd,
        costPerCaseUsd: item.costPerCaseUsd,
        lineTotalUsd: item.lineTotalUsd,
      })),
      totalAmountUsd: supplierOrder.totalAmountUsd,
    };

    const { base64, filename } = exportSupplierOrderToBase64(excelData);

    return {
      base64,
      filename,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  });

export default adminExportSupplierOrderExcel;
