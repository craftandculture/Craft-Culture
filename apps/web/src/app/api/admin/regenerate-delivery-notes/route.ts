import { put } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import renderDeliveryNotePDF from '@/app/_wms/utils/renderDeliveryNotePDF';
import db from '@/database/client';
import {
  wmsDeliveryNotes,
  wmsDispatchBatchOrders,
  wmsDispatchBatches,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';

/**
 * One-off endpoint to regenerate all delivery note PDFs with the updated template.
 * DELETE THIS FILE after running it once.
 *
 * Usage: POST /api/admin/regenerate-delivery-notes?secret=regenerate-dns-2026
 */
export const POST = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') !== 'regenerate-dns-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allNotes = await db
    .select()
    .from(wmsDeliveryNotes)
    .orderBy(wmsDeliveryNotes.generatedAt);

  const results: Array<{ deliveryNoteNumber: string; status: string; pdfUrl?: string }> = [];

  for (const note of allNotes) {
    try {
      // Get the batch
      const [batch] = await db
        .select()
        .from(wmsDispatchBatches)
        .where(eq(wmsDispatchBatches.id, note.batchId));

      if (!batch) {
        results.push({ deliveryNoteNumber: note.deliveryNoteNumber, status: 'batch not found' });
        continue;
      }

      // Get orders linked to this delivery note
      const batchOrders = await db
        .select({
          orderId: wmsDispatchBatchOrders.orderId,
          orderNumber: wmsDispatchBatchOrders.orderNumber,
        })
        .from(wmsDispatchBatchOrders)
        .where(eq(wmsDispatchBatchOrders.deliveryNoteId, note.id));

      // Get Zoho order details + items
      const ordersWithItems = await Promise.all(
        batchOrders.map(async (bo) => {
          const [order] = await db
            .select({
              id: zohoSalesOrders.id,
              salesOrderNumber: zohoSalesOrders.salesOrderNumber,
              customerName: zohoSalesOrders.customerName,
            })
            .from(zohoSalesOrders)
            .where(eq(zohoSalesOrders.id, bo.orderId));

          if (!order) {
            return {
              orderNumber: bo.orderNumber,
              customerName: 'Unknown',
              itemCount: 0,
              totalCases: 0,
              items: [] as Array<{ name: string; sku: string | null; quantity: number; unit: string | null; lwin18: string | null }>,
            };
          }

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

      // Render new PDF
      const pdfBuffer = await renderDeliveryNotePDF({
        deliveryNote: {
          deliveryNoteNumber: note.deliveryNoteNumber,
          generatedAt: note.generatedAt,
        },
        batch: {
          batchNumber: batch.batchNumber,
          distributorName: batch.distributorName,
          orderCount: note.orderCount,
          totalCases: note.totalCases,
          palletCount: batch.palletCount ?? 1,
          notes: batch.notes,
        },
        orders: ordersWithItems,
      });

      // Upload to blob (overwrites same path)
      const blobFilename = `wms/delivery-notes/${note.batchId}/${note.deliveryNoteNumber}.pdf`;
      const blob = await put(blobFilename, pdfBuffer, {
        access: 'public',
        contentType: 'application/pdf',
        allowOverwrite: true,
      });

      // Update the PDF URL
      await db
        .update(wmsDeliveryNotes)
        .set({ pdfUrl: blob.url, updatedAt: new Date() })
        .where(eq(wmsDeliveryNotes.id, note.id));

      results.push({
        deliveryNoteNumber: note.deliveryNoteNumber,
        status: 'regenerated',
        pdfUrl: blob.url,
      });
    } catch (error) {
      results.push({
        deliveryNoteNumber: note.deliveryNoteNumber,
        status: `error: ${error instanceof Error ? error.message : 'unknown'}`,
      });
    }
  }

  return NextResponse.json({ regenerated: results.length, results });
};
