import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  partners,
  sourceSupplierOrderItems,
  sourceSupplierOrders,
} from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import { exportSupplierOrderToBase64 } from '../utils/exportSupplierOrderToExcel';

/**
 * Download a Supplier Order Excel file
 *
 * The file is rebuilt from the order lines on every download rather than
 * served from the stored copy, so older stored files (which carried the C&C
 * end customer) are never handed to the supplier.
 *
 * @example
 *   await trpcClient.source.partner.supplierOrders.downloadExcel.query({
 *     id: "uuid-here",
 *   });
 */
const partnerDownloadSupplierOrderExcel = winePartnerProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input, ctx: { partnerId } }) => {
    const { id } = input;

    // Get supplier order - ensure it belongs to this partner
    const [supplierOrder] = await db
      .select({
        id: sourceSupplierOrders.id,
        orderNumber: sourceSupplierOrders.orderNumber,
        status: sourceSupplierOrders.status,
        totalAmountUsd: sourceSupplierOrders.totalAmountUsd,
        sentAt: sourceSupplierOrders.sentAt,
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

    if (supplierOrder.status === 'draft') {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Excel file not available for this order',
      });
    }

    const [partner] = await db
      .select({ businessName: partners.businessName })
      .from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1);

    const items = await db
      .select()
      .from(sourceSupplierOrderItems)
      .where(eq(sourceSupplierOrderItems.supplierOrderId, id))
      .orderBy(sourceSupplierOrderItems.sortOrder);

    const { base64 } = exportSupplierOrderToBase64({
      orderNumber: supplierOrder.orderNumber,
      partnerName: partner?.businessName ?? '',
      createdAt: supplierOrder.sentAt ?? supplierOrder.createdAt,
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
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `SupplierOrder_${supplierOrder.orderNumber}_${timestamp}.xlsx`;

    return {
      base64,
      filename,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  });

export default partnerDownloadSupplierOrderExcel;
