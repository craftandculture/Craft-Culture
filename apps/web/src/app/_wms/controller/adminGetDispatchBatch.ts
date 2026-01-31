import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  users,
  wmsDeliveryNotes,
  wmsDispatchBatchOrders,
  wmsDispatchBatches,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getDispatchBatchSchema } from '../schemas/dispatchBatchSchema';

/**
 * Get a single dispatch batch with orders and delivery notes
 *
 * @example
 *   await trpcClient.wms.admin.dispatch.getOne.query({ batchId: "uuid" });
 */
const adminGetDispatchBatch = adminProcedure
  .input(getDispatchBatchSchema)
  .query(async ({ input }) => {
    const { batchId } = input;

    // Get batch with dispatcher info
    const [batch] = await db
      .select({
        id: wmsDispatchBatches.id,
        batchNumber: wmsDispatchBatches.batchNumber,
        status: wmsDispatchBatches.status,
        distributorId: wmsDispatchBatches.distributorId,
        distributorName: wmsDispatchBatches.distributorName,
        orderCount: wmsDispatchBatches.orderCount,
        totalCases: wmsDispatchBatches.totalCases,
        palletCount: wmsDispatchBatches.palletCount,
        estimatedWeightKg: wmsDispatchBatches.estimatedWeightKg,
        deliveryNotes: wmsDispatchBatches.deliveryNotes,
        dispatchedAt: wmsDispatchBatches.dispatchedAt,
        dispatchedBy: wmsDispatchBatches.dispatchedBy,
        dispatchedByName: users.name,
        deliveredAt: wmsDispatchBatches.deliveredAt,
        notes: wmsDispatchBatches.notes,
        createdAt: wmsDispatchBatches.createdAt,
      })
      .from(wmsDispatchBatches)
      .leftJoin(users, eq(wmsDispatchBatches.dispatchedBy, users.id))
      .where(eq(wmsDispatchBatches.id, batchId));

    if (!batch) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Dispatch batch not found',
      });
    }

    // Get orders in batch
    const orders = await db
      .select({
        id: wmsDispatchBatchOrders.id,
        orderId: wmsDispatchBatchOrders.orderId,
        orderNumber: wmsDispatchBatchOrders.orderNumber,
        addedAt: wmsDispatchBatchOrders.addedAt,
        deliveryNoteId: wmsDispatchBatchOrders.deliveryNoteId,
      })
      .from(wmsDispatchBatchOrders)
      .where(eq(wmsDispatchBatchOrders.batchId, batchId));

    // Get delivery notes for batch
    const deliveryNotesList = await db
      .select({
        id: wmsDeliveryNotes.id,
        deliveryNoteNumber: wmsDeliveryNotes.deliveryNoteNumber,
        orderCount: wmsDeliveryNotes.orderCount,
        totalCases: wmsDeliveryNotes.totalCases,
        generatedAt: wmsDeliveryNotes.generatedAt,
        generatedByName: users.name,
        pdfUrl: wmsDeliveryNotes.pdfUrl,
        notes: wmsDeliveryNotes.notes,
      })
      .from(wmsDeliveryNotes)
      .leftJoin(users, eq(wmsDeliveryNotes.generatedBy, users.id))
      .where(eq(wmsDeliveryNotes.batchId, batchId));

    // Calculate orders without delivery notes
    const ordersWithDN = new Set(orders.filter((o) => o.deliveryNoteId).map((o) => o.orderId));
    const ordersWithoutDN = orders.filter((o) => !ordersWithDN.has(o.orderId));

    return {
      ...batch,
      orders,
      deliveryNotes: deliveryNotesList,
      ordersWithoutDeliveryNote: ordersWithoutDN.length,
    };
  });

export default adminGetDispatchBatch;
