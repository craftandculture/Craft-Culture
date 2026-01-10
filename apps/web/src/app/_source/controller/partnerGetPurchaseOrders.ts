import { and, desc, eq, ne } from 'drizzle-orm';

import db from '@/database/client';
import { sourcePurchaseOrders, sourceRfqs } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

/**
 * Get all Purchase Orders for the partner
 *
 * Returns POs sent to the authenticated partner with RFQ details.
 *
 * @example
 *   const pos = await trpcClient.source.partner.getPurchaseOrders.query();
 */
const partnerGetPurchaseOrders = winePartnerProcedure.query(async ({ ctx }) => {
  const partnerId = ctx.partnerId;

  // Get all POs for this partner (only those that have been sent)
  const pos = await db
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
      estimatedDeliveryDate: sourcePurchaseOrders.estimatedDeliveryDate,
      shippedAt: sourcePurchaseOrders.shippedAt,
      trackingNumber: sourcePurchaseOrders.trackingNumber,
      deliveredAt: sourcePurchaseOrders.deliveredAt,
      createdAt: sourcePurchaseOrders.createdAt,
      rfqId: sourcePurchaseOrders.rfqId,
      rfqNumber: sourceRfqs.rfqNumber,
      rfqName: sourceRfqs.name,
    })
    .from(sourcePurchaseOrders)
    .leftJoin(sourceRfqs, eq(sourcePurchaseOrders.rfqId, sourceRfqs.id))
    .where(
      and(
        eq(sourcePurchaseOrders.partnerId, partnerId),
        // Only show POs that have been sent (not drafts)
        ne(sourcePurchaseOrders.status, 'draft')
      )
    )
    .orderBy(desc(sourcePurchaseOrders.sentAt));

  // Calculate counts by status
  const summary = {
    total: pos.length,
    pendingConfirmation: pos.filter((po) => po.status === 'sent').length,
    confirmed: pos.filter((po) => po.status === 'confirmed').length,
    shipped: pos.filter((po) => po.status === 'shipped').length,
    delivered: pos.filter((po) => po.status === 'delivered').length,
  };

  return {
    purchaseOrders: pos,
    summary,
  };
});

export default partnerGetPurchaseOrders;
