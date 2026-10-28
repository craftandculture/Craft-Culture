import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
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
        partnerId: sourceSupplierOrders.partnerId,
        status: sourceSupplierOrders.status,
        itemCount: sourceSupplierOrders.itemCount,
        totalAmountUsd: sourceSupplierOrders.totalAmountUsd,
        confirmedAmountUsd: sourceSupplierOrders.confirmedAmountUsd,
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

    // The C&C end customer (name, company, PO) is never returned to the
    // supplier. Items are an explicit allowlist (no internal links).
    const items = await db
      .select({
        id: sourceSupplierOrderItems.id,
        supplierOrderId: sourceSupplierOrderItems.supplierOrderId,
        quoteId: sourceSupplierOrderItems.quoteId,
        productName: sourceSupplierOrderItems.productName,
        producer: sourceSupplierOrderItems.producer,
        vintage: sourceSupplierOrderItems.vintage,
        region: sourceSupplierOrderItems.region,
        lwin7: sourceSupplierOrderItems.lwin7,
        lwin18: sourceSupplierOrderItems.lwin18,
        bottleSize: sourceSupplierOrderItems.bottleSize,
        caseConfig: sourceSupplierOrderItems.caseConfig,
        quantityCases: sourceSupplierOrderItems.quantityCases,
        quantityBottles: sourceSupplierOrderItems.quantityBottles,
        costPerBottleUsd: sourceSupplierOrderItems.costPerBottleUsd,
        costPerCaseUsd: sourceSupplierOrderItems.costPerCaseUsd,
        lineTotalUsd: sourceSupplierOrderItems.lineTotalUsd,
        confirmationStatus: sourceSupplierOrderItems.confirmationStatus,
        confirmedAt: sourceSupplierOrderItems.confirmedAt,
        updatedPriceUsd: sourceSupplierOrderItems.updatedPriceUsd,
        updatedQuantity: sourceSupplierOrderItems.updatedQuantity,
        updateReason: sourceSupplierOrderItems.updateReason,
        rejectionReason: sourceSupplierOrderItems.rejectionReason,
        partnerNotes: sourceSupplierOrderItems.partnerNotes,
        sortOrder: sourceSupplierOrderItems.sortOrder,
      })
      .from(sourceSupplierOrderItems)
      .where(eq(sourceSupplierOrderItems.supplierOrderId, id))
      .orderBy(sourceSupplierOrderItems.sortOrder);

    return {
      ...supplierOrder,
      items,
    };
  });

export default partnerGetOneSupplierOrder;
