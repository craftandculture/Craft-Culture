import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';
import { and, eq, gt, inArray, like, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  partners,
  privateClientOrderItems,
  privateClientOrders,
  wmsDeliveryNotes,
  wmsDispatchBatchOrders,
  wmsDispatchBatches,
  wmsStock,
  wmsStockMovements,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import convertReservationToPick from '../utils/convertReservationToPick';
import generateBatchNumber from '../utils/generateBatchNumber';
import generateDeliveryNoteNumber from '../utils/generateDeliveryNoteNumber';
import generateMovementNumber from '../utils/generateMovementNumber';
import renderDeliveryNotePDF from '../utils/renderDeliveryNotePDF';

/**
 * Quick dispatch wizard — one-shot endpoint that creates a dispatch batch,
 * adds orders (Zoho + PCO), optionally generates a delivery note PDF,
 * and marks everything as dispatched.
 *
 * @example
 *   await trpcClient.wms.admin.dispatch.quickDispatch.mutate({
 *     distributorId: "uuid",
 *     orderIds: [
 *       { id: "zoho-uuid", type: "zoho" },
 *       { id: "pco-uuid", type: "pco" },
 *     ],
 *     generateDeliveryNote: true,
 *     notes: "Truck #42",
 *   });
 */
const adminQuickDispatch = adminProcedure
  .input(
    z.object({
      distributorId: z.string().uuid(),
      orderIds: z
        .array(
          z.object({
            id: z.string().uuid(),
            type: z.enum(['zoho', 'pco']),
          }),
        )
        .min(1),
      generateDeliveryNote: z.boolean().default(true),
      notes: z.string().optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { distributorId, orderIds, generateDeliveryNote, notes } = input;

    // Get distributor info
    const [distributor] = await db
      .select({
        id: partners.id,
        name: partners.businessName,
      })
      .from(partners)
      .where(eq(partners.id, distributorId));

    if (!distributor) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Distributor not found',
      });
    }

    // Split order IDs by type
    const zohoOrderIds = orderIds
      .filter((o) => o.type === 'zoho')
      .map((o) => o.id);
    const pcoOrderIds = orderIds
      .filter((o) => o.type === 'pco')
      .map((o) => o.id);

    // Generate batch number and create batch
    const batchNumber = await generateBatchNumber();
    const now = new Date();

    const [batch] = await db
      .insert(wmsDispatchBatches)
      .values({
        batchNumber,
        distributorId,
        distributorName: distributor.name,
        status: 'dispatched',
        orderCount: orderIds.length,
        totalCases: 0,
        dispatchedAt: now,
        dispatchedBy: ctx.user.id,
        notes: notes ?? null,
      })
      .returning();

    if (!batch) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create dispatch batch',
      });
    }

    const batchId = batch.id;
    let totalCases = 0;
    const batchOrderInserts: Array<{
      batchId: string;
      orderId: string;
      orderNumber: string;
    }> = [];

    // Process Zoho orders
    if (zohoOrderIds.length > 0) {
      const zohoRows = await db
        .select({
          id: zohoSalesOrders.id,
          salesOrderNumber: zohoSalesOrders.salesOrderNumber,
        })
        .from(zohoSalesOrders)
        .where(inArray(zohoSalesOrders.id, zohoOrderIds));

      if (zohoRows.length > 0) {
        // Update Zoho orders
        await db
          .update(zohoSalesOrders)
          .set({
            dispatchBatchId: batchId,
            status: 'dispatched',
            updatedAt: now,
          })
          .where(
            inArray(
              zohoSalesOrders.id,
              zohoRows.map((o) => o.id),
            ),
          );

        // Calculate cases
        const [casesResult] = await db
          .select({
            total: sql<number>`COALESCE(SUM(${zohoSalesOrderItems.quantity}), 0)::int`,
          })
          .from(zohoSalesOrderItems)
          .where(
            inArray(
              zohoSalesOrderItems.salesOrderId,
              zohoRows.map((o) => o.id),
            ),
          );

        totalCases += casesResult?.total ?? 0;

        for (const row of zohoRows) {
          batchOrderInserts.push({
            batchId,
            orderId: row.id,
            orderNumber: row.salesOrderNumber,
          });
        }
      }
    }

    // Process PCO orders
    if (pcoOrderIds.length > 0) {
      const pcoRows = await db
        .select({
          id: privateClientOrders.id,
          orderNumber: privateClientOrders.orderNumber,
        })
        .from(privateClientOrders)
        .where(inArray(privateClientOrders.id, pcoOrderIds));

      if (pcoRows.length > 0) {
        // Update PCO order status
        await db
          .update(privateClientOrders)
          .set({
            status: 'stock_in_transit',
            updatedAt: now,
          })
          .where(
            inArray(
              privateClientOrders.id,
              pcoRows.map((o) => o.id),
            ),
          );

        // Calculate cases
        const [casesResult] = await db
          .select({
            total: sql<number>`COALESCE(SUM(${privateClientOrderItems.quantity}), 0)::int`,
          })
          .from(privateClientOrderItems)
          .where(
            inArray(
              privateClientOrderItems.orderId,
              pcoRows.map((o) => o.id),
            ),
          );

        totalCases += casesResult?.total ?? 0;

        for (const row of pcoRows) {
          batchOrderInserts.push({
            batchId,
            orderId: row.id,
            orderNumber: row.orderNumber,
          });
        }
      }
    }

    // Insert batch order records
    if (batchOrderInserts.length > 0) {
      await db.insert(wmsDispatchBatchOrders).values(batchOrderInserts);
    }

    // Decrement stock — Quick Dispatch skips picking so stock must be decremented here
    for (const orderRef of orderIds) {
      if (orderRef.type === 'zoho') {
        const items = await db
          .select({
            lwin18: zohoSalesOrderItems.lwin18,
            sku: zohoSalesOrderItems.sku,
            name: zohoSalesOrderItems.name,
            quantity: zohoSalesOrderItems.quantity,
          })
          .from(zohoSalesOrderItems)
          .where(eq(zohoSalesOrderItems.salesOrderId, orderRef.id));

        for (const item of items) {
          const lwin = item.lwin18 ?? item.sku;
          if (!lwin || item.quantity <= 0) continue;

          const stockRecords = await db
            .select({
              id: wmsStock.id,
              quantityCases: wmsStock.quantityCases,
            })
            .from(wmsStock)
            .where(
              and(eq(wmsStock.lwin18, lwin), gt(wmsStock.quantityCases, 0)),
            );

          let remaining = item.quantity;
          for (const stock of stockRecords) {
            if (remaining <= 0) break;
            const toPick = Math.min(remaining, stock.quantityCases);

            const result = await convertReservationToPick({
              stockId: stock.id,
              orderId: orderRef.id,
              quantityCases: toPick,
              db,
            });

            remaining -= result.totalPicked;
          }

          const picked = item.quantity - remaining;
          if (picked > 0) {
            const movementNumber = await generateMovementNumber();
            await db.insert(wmsStockMovements).values({
              movementNumber,
              movementType: 'pick',
              lwin18: lwin,
              productName: item.name,
              quantityCases: picked,
              orderId: orderRef.id,
              notes: `Quick dispatch ${batchNumber}`,
              performedBy: ctx.user.id,
              performedAt: now,
            });
          }
        }
      } else {
        // PCO order
        const items = await db
          .select({
            lwin: privateClientOrderItems.lwin,
            productName: privateClientOrderItems.productName,
            quantity: privateClientOrderItems.quantity,
          })
          .from(privateClientOrderItems)
          .where(eq(privateClientOrderItems.orderId, orderRef.id));

        for (const item of items) {
          if (!item.lwin || item.quantity <= 0) continue;

          // Exact LWIN match first
          let stockRecords = await db
            .select({
              id: wmsStock.id,
              quantityCases: wmsStock.quantityCases,
            })
            .from(wmsStock)
            .where(
              and(
                eq(wmsStock.lwin18, item.lwin),
                gt(wmsStock.quantityCases, 0),
              ),
            );

          // Prefix match for short LWINs
          if (stockRecords.length === 0) {
            stockRecords = await db
              .select({
                id: wmsStock.id,
                quantityCases: wmsStock.quantityCases,
              })
              .from(wmsStock)
              .where(
                and(
                  like(wmsStock.lwin18, `${item.lwin}%`),
                  gt(wmsStock.quantityCases, 0),
                ),
              );
          }

          let remaining = item.quantity;
          for (const stock of stockRecords) {
            if (remaining <= 0) break;
            const toPick = Math.min(remaining, stock.quantityCases);

            const result = await convertReservationToPick({
              stockId: stock.id,
              orderId: orderRef.id,
              quantityCases: toPick,
              db,
            });

            remaining -= result.totalPicked;
          }

          const picked = item.quantity - remaining;
          if (picked > 0) {
            const movementNumber = await generateMovementNumber();
            await db.insert(wmsStockMovements).values({
              movementNumber,
              movementType: 'pick',
              lwin18: item.lwin,
              productName: item.productName,
              quantityCases: picked,
              orderId: orderRef.id,
              notes: `Quick dispatch ${batchNumber}`,
              performedBy: ctx.user.id,
              performedAt: now,
            });
          }
        }
      }
    }

    // Update batch totals
    const [updatedBatch] = await db
      .update(wmsDispatchBatches)
      .set({
        orderCount: batchOrderInserts.length,
        totalCases,
        updatedAt: now,
      })
      .where(eq(wmsDispatchBatches.id, batchId))
      .returning();

    // Generate delivery note if requested
    let deliveryNote: { pdfUrl: string; deliveryNoteNumber: string } | null =
      null;

    if (generateDeliveryNote && batchOrderInserts.length > 0) {
      // Get Zoho order details for the PDF
      const ordersWithItems = await Promise.all(
        zohoOrderIds.map(async (orderId) => {
          const [order] = await db
            .select({
              id: zohoSalesOrders.id,
              salesOrderNumber: zohoSalesOrders.salesOrderNumber,
              customerName: zohoSalesOrders.customerName,
            })
            .from(zohoSalesOrders)
            .where(eq(zohoSalesOrders.id, orderId));

          if (!order) return null;

          const items = await db
            .select({
              name: zohoSalesOrderItems.name,
              sku: zohoSalesOrderItems.sku,
              quantity: zohoSalesOrderItems.quantity,
            })
            .from(zohoSalesOrderItems)
            .where(eq(zohoSalesOrderItems.salesOrderId, order.id));

          const orderTotalCases = items.reduce(
            (sum, item) => sum + item.quantity,
            0,
          );

          return {
            orderNumber: order.salesOrderNumber,
            customerName: order.customerName,
            itemCount: items.length,
            totalCases: orderTotalCases,
            items,
          };
        }),
      );

      const validOrders = ordersWithItems.filter(
        (o): o is NonNullable<typeof o> => o !== null,
      );

      const deliveryNoteNumber = await generateDeliveryNoteNumber();

      const pdfBuffer = await renderDeliveryNotePDF({
        deliveryNote: {
          deliveryNoteNumber,
          generatedAt: now,
        },
        batch: {
          batchNumber,
          distributorName: distributor.name,
          orderCount: batchOrderInserts.length,
          totalCases,
          palletCount: 1,
          notes: notes ?? null,
        },
        orders: validOrders,
      });

      // Upload PDF
      const blobFilename = `wms/delivery-notes/${batchId}/${deliveryNoteNumber}.pdf`;
      const blob = await put(blobFilename, pdfBuffer, {
        access: 'public',
        contentType: 'application/pdf',
      });

      // Create delivery note record
      const [dnRecord] = await db
        .insert(wmsDeliveryNotes)
        .values({
          deliveryNoteNumber,
          batchId,
          orderCount: batchOrderInserts.length,
          totalCases,
          generatedAt: now,
          generatedBy: ctx.user.id,
          pdfUrl: blob.url,
        })
        .returning();

      // Link all batch orders to the delivery note
      if (dnRecord) {
        await db
          .update(wmsDispatchBatchOrders)
          .set({
            deliveryNoteId: dnRecord.id,
            updatedAt: now,
          })
          .where(eq(wmsDispatchBatchOrders.batchId, batchId));

        deliveryNote = {
          pdfUrl: blob.url,
          deliveryNoteNumber,
        };
      }
    }

    return {
      success: true,
      batch: updatedBatch ?? batch,
      deliveryNote,
      message: `Dispatched ${batchOrderInserts.length} orders (${totalCases} cases) as ${batchNumber}`,
    };
  });

export default adminQuickDispatch;
