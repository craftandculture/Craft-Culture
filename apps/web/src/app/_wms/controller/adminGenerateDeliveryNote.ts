import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  wmsDeliveryNotes,
  wmsDispatchBatchOrders,
  wmsDispatchBatches,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import generateDeliveryNoteNumber from '../utils/generateDeliveryNoteNumber';
import renderDeliveryNotePDF from '../utils/renderDeliveryNotePDF';

/**
 * Generate a delivery note for a dispatch batch
 *
 * Creates a delivery note record, generates a PDF, uploads to storage,
 * and links the orders in the batch to the delivery note.
 *
 * @example
 *   await trpcClient.wms.admin.dispatch.generateDeliveryNote.mutate({
 *     batchId: "uuid",
 *   });
 */
const adminGenerateDeliveryNote = adminProcedure
  .input(
    z.object({
      batchId: z.string().uuid(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { batchId } = input;

    // Get batch
    const [batch] = await db
      .select()
      .from(wmsDispatchBatches)
      .where(eq(wmsDispatchBatches.id, batchId));

    if (!batch) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Dispatch batch not found',
      });
    }

    // Get orders in batch
    const batchOrders = await db
      .select({
        id: wmsDispatchBatchOrders.id,
        orderId: wmsDispatchBatchOrders.orderId,
        orderNumber: wmsDispatchBatchOrders.orderNumber,
        deliveryNoteId: wmsDispatchBatchOrders.deliveryNoteId,
      })
      .from(wmsDispatchBatchOrders)
      .where(eq(wmsDispatchBatchOrders.batchId, batchId));

    // Filter orders that don't have a delivery note
    const ordersWithoutDN = batchOrders.filter((o) => !o.deliveryNoteId);

    if (ordersWithoutDN.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'All orders in this batch already have delivery notes',
      });
    }

    // Get Zoho order details for the orders
    const orderIds = ordersWithoutDN.map((o) => o.orderId);

    // Get all Zoho orders using individual queries (simpler than dynamic IN clause)
    const allZohoOrders: Array<{
      id: string;
      salesOrderNumber: string;
      customerName: string;
    }> = [];

    for (const orderId of orderIds) {
      const [order] = await db
        .select({
          id: zohoSalesOrders.id,
          salesOrderNumber: zohoSalesOrders.salesOrderNumber,
          customerName: zohoSalesOrders.customerName,
        })
        .from(zohoSalesOrders)
        .where(eq(zohoSalesOrders.id, orderId));

      if (order) {
        allZohoOrders.push(order);
      }
    }

    // Get items for each order
    const ordersWithItems = await Promise.all(
      allZohoOrders.map(async (order) => {
        const items = await db
          .select({
            name: zohoSalesOrderItems.name,
            sku: zohoSalesOrderItems.sku,
            quantity: zohoSalesOrderItems.quantity,
            unit: zohoSalesOrderItems.unit,
            lwin18: zohoSalesOrderItems.lwin18,
          })
          .from(zohoSalesOrderItems)
          .where(eq(zohoSalesOrderItems.salesOrderId, order.id));

        const totalCases = items.reduce((sum, item) => sum + item.quantity, 0);

        return {
          orderNumber: order.salesOrderNumber,
          customerName: order.customerName,
          itemCount: items.length,
          totalCases,
          items,
        };
      }),
    );

    // Generate delivery note number
    const deliveryNoteNumber = await generateDeliveryNoteNumber();
    const generatedAt = new Date();

    // Calculate totals
    const totalCases = ordersWithItems.reduce((sum, o) => sum + o.totalCases, 0);

    // Generate PDF
    const pdfBuffer = await renderDeliveryNotePDF({
      deliveryNote: {
        deliveryNoteNumber,
        generatedAt,
      },
      batch: {
        batchNumber: batch.batchNumber,
        distributorName: batch.distributorName,
        orderCount: ordersWithoutDN.length,
        totalCases,
        palletCount: batch.palletCount ?? 1,
        notes: batch.notes,
      },
      orders: ordersWithItems,
    });

    // Upload PDF to Vercel Blob
    const blobFilename = `wms/delivery-notes/${batchId}/${deliveryNoteNumber}.pdf`;
    const blob = await put(blobFilename, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf',
    });

    // Create delivery note record
    const [deliveryNote] = await db
      .insert(wmsDeliveryNotes)
      .values({
        deliveryNoteNumber,
        batchId,
        orderCount: ordersWithoutDN.length,
        totalCases,
        generatedAt,
        generatedBy: ctx.user.id,
        pdfUrl: blob.url,
      })
      .returning();

    // Link orders to delivery note
    for (const order of ordersWithoutDN) {
      await db
        .update(wmsDispatchBatchOrders)
        .set({
          deliveryNoteId: deliveryNote!.id,
          updatedAt: new Date(),
        })
        .where(eq(wmsDispatchBatchOrders.id, order.id));
    }

    return {
      success: true,
      deliveryNote: {
        id: deliveryNote!.id,
        deliveryNoteNumber,
        pdfUrl: blob.url,
        orderCount: ordersWithoutDN.length,
        totalCases,
      },
    };
  });

export default adminGenerateDeliveryNote;
