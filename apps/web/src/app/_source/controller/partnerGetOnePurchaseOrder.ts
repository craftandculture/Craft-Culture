import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  sourcePurchaseOrderItems,
  sourcePurchaseOrders,
  sourceRfqs,
} from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

const getOnePurchaseOrderSchema = z.object({
  poId: z.string().uuid(),
});

/**
 * Get a single Purchase Order with full details for partner view
 *
 * @example
 *   const po = await trpcClient.source.partner.getOnePurchaseOrder.query({
 *     poId: "uuid"
 *   });
 */
const partnerGetOnePurchaseOrder = winePartnerProcedure
  .input(getOnePurchaseOrderSchema)
  .query(async ({ input, ctx }) => {
    const { poId } = input;
    const partnerId = ctx.partnerId;

    // Get the PO (must belong to this partner and not be draft)
    const [po] = await db
      .select({
        id: sourcePurchaseOrders.id,
        poNumber: sourcePurchaseOrders.poNumber,
        status: sourcePurchaseOrders.status,
        totalAmountUsd: sourcePurchaseOrders.totalAmountUsd,
        currency: sourcePurchaseOrders.currency,
        deliveryDate: sourcePurchaseOrders.deliveryDate,
        deliveryAddress: sourcePurchaseOrders.deliveryAddress,
        deliveryInstructions: sourcePurchaseOrders.deliveryInstructions,
        paymentTerms: sourcePurchaseOrders.paymentTerms,
        notes: sourcePurchaseOrders.notes,
        pdfUrl: sourcePurchaseOrders.pdfUrl,
        sentAt: sourcePurchaseOrders.sentAt,
        confirmedAt: sourcePurchaseOrders.confirmedAt,
        confirmationNotes: sourcePurchaseOrders.confirmationNotes,
        estimatedDeliveryDate: sourcePurchaseOrders.estimatedDeliveryDate,
        shippedAt: sourcePurchaseOrders.shippedAt,
        trackingNumber: sourcePurchaseOrders.trackingNumber,
        shippingNotes: sourcePurchaseOrders.shippingNotes,
        deliveredAt: sourcePurchaseOrders.deliveredAt,
        deliveryNotes: sourcePurchaseOrders.deliveryNotes,
        createdAt: sourcePurchaseOrders.createdAt,
        rfqId: sourcePurchaseOrders.rfqId,
        rfqNumber: sourceRfqs.rfqNumber,
        rfqName: sourceRfqs.name,
      })
      .from(sourcePurchaseOrders)
      .leftJoin(sourceRfqs, eq(sourcePurchaseOrders.rfqId, sourceRfqs.id))
      .where(
        and(
          eq(sourcePurchaseOrders.id, poId),
          eq(sourcePurchaseOrders.partnerId, partnerId)
        )
      );

    if (!po) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Purchase Order not found',
      });
    }

    // Draft POs are not visible to partners
    if (po.status === 'draft') {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Purchase Order not found',
      });
    }

    // Get all items for this PO
    const items = await db
      .select({
        id: sourcePurchaseOrderItems.id,
        productName: sourcePurchaseOrderItems.productName,
        producer: sourcePurchaseOrderItems.producer,
        vintage: sourcePurchaseOrderItems.vintage,
        lwin: sourcePurchaseOrderItems.lwin,
        quantity: sourcePurchaseOrderItems.quantity,
        unitType: sourcePurchaseOrderItems.unitType,
        caseConfig: sourcePurchaseOrderItems.caseConfig,
        unitPriceUsd: sourcePurchaseOrderItems.unitPriceUsd,
        lineTotalUsd: sourcePurchaseOrderItems.lineTotalUsd,
        status: sourcePurchaseOrderItems.status,
        confirmedAt: sourcePurchaseOrderItems.confirmedAt,
        rejectionReason: sourcePurchaseOrderItems.rejectionReason,
      })
      .from(sourcePurchaseOrderItems)
      .where(eq(sourcePurchaseOrderItems.poId, poId));

    return {
      ...po,
      items,
    };
  });

export default partnerGetOnePurchaseOrder;
