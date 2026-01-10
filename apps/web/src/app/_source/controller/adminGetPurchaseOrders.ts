import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  partners,
  sourcePurchaseOrderItems,
  sourcePurchaseOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const getPurchaseOrdersSchema = z.object({
  rfqId: z.string().uuid(),
});

/**
 * Get all Purchase Orders for an RFQ
 *
 * Returns POs with partner details and line items for admin review.
 *
 * @example
 *   const pos = await trpcClient.source.admin.getPurchaseOrders.query({
 *     rfqId: "uuid"
 *   });
 */
const adminGetPurchaseOrders = adminProcedure
  .input(getPurchaseOrdersSchema)
  .query(async ({ input }) => {
    const { rfqId } = input;

    // Get all POs for this RFQ with partner details
    const pos = await db
      .select({
        id: sourcePurchaseOrders.id,
        poNumber: sourcePurchaseOrders.poNumber,
        status: sourcePurchaseOrders.status,
        totalAmountUsd: sourcePurchaseOrders.totalAmountUsd,
        currency: sourcePurchaseOrders.currency,
        deliveryDate: sourcePurchaseOrders.deliveryDate,
        deliveryAddress: sourcePurchaseOrders.deliveryAddress,
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
        cancelledAt: sourcePurchaseOrders.cancelledAt,
        cancellationReason: sourcePurchaseOrders.cancellationReason,
        createdAt: sourcePurchaseOrders.createdAt,
        partnerId: sourcePurchaseOrders.partnerId,
        partnerName: partners.businessName,
        partnerBusinessName: partners.businessName,
      })
      .from(sourcePurchaseOrders)
      .leftJoin(partners, eq(sourcePurchaseOrders.partnerId, partners.id))
      .where(eq(sourcePurchaseOrders.rfqId, rfqId))
      .orderBy(sourcePurchaseOrders.createdAt);

    // Get items for each PO
    const poIds = pos.map((po) => po.id);

    const allItems =
      poIds.length > 0
        ? await db
            .select({
              id: sourcePurchaseOrderItems.id,
              poId: sourcePurchaseOrderItems.poId,
              rfqItemId: sourcePurchaseOrderItems.rfqItemId,
              quoteId: sourcePurchaseOrderItems.quoteId,
              productName: sourcePurchaseOrderItems.productName,
              producer: sourcePurchaseOrderItems.producer,
              vintage: sourcePurchaseOrderItems.vintage,
              lwin: sourcePurchaseOrderItems.lwin,
              quantity: sourcePurchaseOrderItems.quantity,
              unitType: sourcePurchaseOrderItems.unitType,
              caseConfig: sourcePurchaseOrderItems.caseConfig,
              unitPriceUsd: sourcePurchaseOrderItems.unitPriceUsd,
              lineTotalUsd: sourcePurchaseOrderItems.lineTotalUsd,
            })
            .from(sourcePurchaseOrderItems)
            .where(inArray(sourcePurchaseOrderItems.poId, poIds))
        : [];

    // Group items by PO ID
    const itemsByPoId = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const items = itemsByPoId.get(item.poId) ?? [];
      items.push(item);
      itemsByPoId.set(item.poId, items);
    }

    // Combine POs with their items
    const purchaseOrders = pos.map((po) => ({
      ...po,
      items: itemsByPoId.get(po.id) ?? [],
    }));

    // Calculate summary
    const summary = {
      totalPOs: purchaseOrders.length,
      draftCount: purchaseOrders.filter((po) => po.status === 'draft').length,
      sentCount: purchaseOrders.filter((po) => po.status === 'sent').length,
      confirmedCount: purchaseOrders.filter((po) => po.status === 'confirmed').length,
      shippedCount: purchaseOrders.filter((po) => po.status === 'shipped').length,
      deliveredCount: purchaseOrders.filter((po) => po.status === 'delivered').length,
      cancelledCount: purchaseOrders.filter((po) => po.status === 'cancelled').length,
      grandTotalUsd: purchaseOrders.reduce(
        (sum, po) => sum + (po.totalAmountUsd ?? 0),
        0
      ),
    };

    return {
      purchaseOrders,
      summary,
    };
  });

export default adminGetPurchaseOrders;
