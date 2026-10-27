import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';
import { and, eq, gt, inArray, like, ne, sql } from 'drizzle-orm';
import { z } from 'zod';

import announceDispatch from '@/app/_wms/data/announceDispatch';
import db from '@/database/client';
import {
  partners,
  privateClientOrderItems,
  privateClientOrders,
  wmsDeliveryNotes,
  wmsDispatchBatchOrders,
  wmsDispatchBatches,
  wmsPickListItems,
  wmsPickLists,
  wmsStock,
  wmsStockMovements,
  wmsStockReservations,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import convertReservationToPick from '../utils/convertReservationToPick';
import generateBatchNumber from '../utils/generateBatchNumber';
import generateDeliveryNoteNumber from '../utils/generateDeliveryNoteNumber';
import generateMovementNumber from '../utils/generateMovementNumber';
import lwinPackAgnosticPattern from '../utils/lwinPackAgnosticPattern';
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
const adminQuickDispatch = wmsOperatorProcedure
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
      /*
        Yes to shipping lines that did not leave the shelf through a scan: lines
        on a pick list nobody scanned, or wine the shelf does not hold. Without
        it those are listed back and nothing is dispatched.
      */
      confirmUnpicked: z.boolean().default(false),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { distributorId, orderIds, generateDeliveryNote, notes, confirmUnpicked } = input;

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
    const zohoOrderIds = [
      ...new Set(orderIds.filter((o) => o.type === 'zoho').map((o) => o.id)),
    ];
    const pcoOrderIds = [
      ...new Set(orderIds.filter((o) => o.type === 'pco').map((o) => o.id)),
    ];

    const now = new Date();

    /*
      Everything in one transaction with the orders locked. Before, a double
      tap made two batches and took the stock off the shelf twice; an order
      half-way through its pick list was treated as fully picked; a PCO that
      had been picked was decremented again; and a member's held wine could
      be drawn for somebody else's PCO.
    */
    const { batch, updatedBatch, batchNumber, batchOrderInserts, totalCases } =
      await db.transaction(async (tx) => {
        const zohoRows =
          zohoOrderIds.length > 0
            ? await tx
                .select({
                  id: zohoSalesOrders.id,
                  salesOrderNumber: zohoSalesOrders.salesOrderNumber,
                  status: zohoSalesOrders.status,
                  dispatchBatchId: zohoSalesOrders.dispatchBatchId,
                })
                .from(zohoSalesOrders)
                .where(inArray(zohoSalesOrders.id, zohoOrderIds))
                .for('update')
            : [];

        const pcoRows =
          pcoOrderIds.length > 0
            ? await tx
                .select({
                  id: privateClientOrders.id,
                  orderNumber: privateClientOrders.orderNumber,
                  partnerId: privateClientOrders.partnerId,
                })
                .from(privateClientOrders)
                .where(inArray(privateClientOrders.id, pcoOrderIds))
                .for('update')
            : [];

        // Already on a dispatch batch: a retry or a second tap. Never twice.
        const alreadyDispatched = [
          ...zohoRows
            .filter(
              (row) =>
                row.dispatchBatchId ||
                ['dispatched', 'delivered'].includes(row.status ?? ''),
            )
            .map((row) => row.salesOrderNumber),
        ];
        if (pcoRows.length > 0) {
          const onBatch = await tx
            .select({ orderId: wmsDispatchBatchOrders.orderId })
            .from(wmsDispatchBatchOrders)
            .where(
              inArray(
                wmsDispatchBatchOrders.orderId,
                pcoRows.map((row) => row.id),
              ),
            );
          const onBatchIds = new Set(onBatch.map((row) => row.orderId));
          alreadyDispatched.push(
            ...pcoRows.filter((row) => onBatchIds.has(row.id)).map((row) => row.orderNumber),
          );
        }

        if (alreadyDispatched.length > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Already dispatched: ${alreadyDispatched.join(', ')}. Refresh the list.`,
          });
        }

        // Where each order is in picking. Lines scanned on a pick list have
        // already left their bay; lines not yet scanned have not.
        const allIds = [...zohoRows.map((row) => row.id), ...pcoRows.map((row) => row.id)];
        const pickLists =
          allIds.length > 0
            ? await tx
                .select({
                  id: wmsPickLists.id,
                  orderId: wmsPickLists.orderId,
                  status: wmsPickLists.status,
                  pickListNumber: wmsPickLists.pickListNumber,
                })
                .from(wmsPickLists)
                .where(
                  and(
                    inArray(wmsPickLists.orderId, allIds),
                    ne(wmsPickLists.status, 'cancelled'),
                  ),
                )
                .for('update')
            : [];

        const openLists = pickLists.filter((list) => list.status !== 'completed');
        const completedOrderIds = new Set(
          pickLists.filter((list) => list.status === 'completed').map((list) => list.orderId),
        );

        const unpickedLines =
          openLists.length > 0
            ? await tx
                .select({
                  id: wmsPickListItems.id,
                  pickListId: wmsPickListItems.pickListId,
                  lwin18: wmsPickListItems.lwin18,
                  productName: wmsPickListItems.productName,
                  quantityCases: wmsPickListItems.quantityCases,
                  quantityBottles: wmsPickListItems.quantityBottles,
                })
                .from(wmsPickListItems)
                .where(
                  and(
                    inArray(
                      wmsPickListItems.pickListId,
                      openLists.map((list) => list.id),
                    ),
                    sql`${wmsPickListItems.isPicked} IS NOT TRUE`,
                  ),
                )
                .for('update')
            : [];

        const problems: string[] = [];

        if (unpickedLines.length > 0 && !confirmUnpicked) {
          const lists = openLists
            .filter((list) => unpickedLines.some((line) => line.pickListId === list.id))
            .map((list) => list.pickListNumber);
          problems.push(
            `${unpickedLines.length} line(s) on ${lists.join(', ')} have not been scanned`,
          );
        }

        const batchNumber = await generateBatchNumber(tx);

        const [batch] = await tx
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

        /*
          Take one line's wine off the shelf.

          Cases reserved for this order come first, then stock that is for sale
          (the order's own partner first, for a PCO). Held wine is never drawn
          unless it was reserved for this very order. A line ordered by the
          bottle draws only single-bottle rows: cracking a case is done on the
          pick list, which relabels what is left — here it would take a whole
          case for every bottle.
        */
        const drawLine = async ({
          orderId,
          orderNumber,
          lwin,
          productName,
          quantity,
          isBottleLine,
          pack,
          preferOwnerId,
          allowPrefix,
        }: {
          orderId: string;
          orderNumber: string;
          lwin: string;
          productName: string;
          quantity: number;
          isBottleLine: boolean;
          pack: number | null;
          preferOwnerId: string | null;
          allowPrefix: boolean;
        }) => {
          const singlesPattern = isBottleLine ? lwinPackAgnosticPattern(lwin) : null;
          const match = singlesPattern
            ? like(wmsStock.lwin18, singlesPattern)
            : eq(wmsStock.lwin18, lwin);

          const select = (where: ReturnType<typeof and>) =>
            tx
              .select({
                id: wmsStock.id,
                quantityCases: wmsStock.quantityCases,
                ownerId: wmsStock.ownerId,
                notForSale: wmsStock.notForSale,
                caseConfig: wmsStock.caseConfig,
              })
              .from(wmsStock)
              .where(where)
              .for('update');

          let rows = await select(and(match, gt(wmsStock.quantityCases, 0)));
          if (rows.length === 0 && allowPrefix && !singlesPattern) {
            rows = await select(
              and(like(wmsStock.lwin18, `${lwin}%`), gt(wmsStock.quantityCases, 0)),
            );
          }

          const reservedHere = new Set(
            (
              await tx
                .select({ stockId: wmsStockReservations.stockId })
                .from(wmsStockReservations)
                .where(
                  and(
                    eq(wmsStockReservations.orderId, orderId),
                    eq(wmsStockReservations.status, 'active'),
                  ),
                )
            ).map((row) => row.stockId),
          );

          const usable = rows
            .filter((row) => reservedHere.has(row.id) || !row.notForSale)
            .filter((row) =>
              isBottleLine
                ? (row.caseConfig ?? 12) === 1
                : !pack || pack <= 1 || row.caseConfig == null || row.caseConfig === pack,
            )
            .sort((left, right) => {
              const rank = (row: (typeof rows)[number]) =>
                (reservedHere.has(row.id) ? 0 : 2) +
                (preferOwnerId && row.ownerId === preferOwnerId ? 0 : 1);
              return rank(left) - rank(right);
            });

          let remaining = quantity;
          for (const stock of usable) {
            if (remaining <= 0) break;
            const toPick = Math.min(remaining, stock.quantityCases);

            const result = await convertReservationToPick({
              stockId: stock.id,
              orderId,
              quantityCases: toPick,
              db: tx,
            });

            remaining -= result.totalPicked;

            // One movement per row drawn, so each owner's bottles are accounted for (Index 3.0)
            if (result.totalPicked > 0) {
              await tx.insert(wmsStockMovements).values({
                movementNumber: await generateMovementNumber(tx),
                movementType: 'pick',
                lwin18: lwin,
                productName,
                quantityCases: result.totalPicked,
                quantityBottles: result.totalPicked * (stock.caseConfig ?? 1),
                fromOwnerId: stock.ownerId,
                stockId: stock.id,
                orderId,
                notes: `Quick dispatch ${batchNumber}`,
                performedBy: ctx.user.id,
                performedAt: now,
              });
            }
          }

          if (remaining > 0) {
            problems.push(
              `${orderNumber}: ${remaining} ${isBottleLine ? 'bottle(s)' : 'case(s)'} of ${productName} not found on the shelf` +
                (isBottleLine ? ' as single bottles (pick it on a pick list to open a case)' : ''),
            );
          }
        };

        // Lines on an open pick list that nobody scanned: only with a yes
        if (confirmUnpicked) {
          for (const line of unpickedLines) {
            const list = openLists.find((entry) => entry.id === line.pickListId);
            const isBottleLine = line.quantityBottles != null;
            await drawLine({
              orderId: list?.orderId ?? '',
              orderNumber: list?.pickListNumber ?? '',
              lwin: line.lwin18,
              productName: line.productName,
              quantity: isBottleLine ? (line.quantityBottles ?? 0) : line.quantityCases,
              isBottleLine,
              pack: null,
              preferOwnerId: null,
              allowPrefix: false,
            });
            await tx
              .update(wmsPickListItems)
              .set({
                isPicked: true,
                pickedQuantity: isBottleLine ? line.quantityBottles : line.quantityCases,
                pickedAt: now,
                pickedBy: ctx.user.id,
                notes: `Shipped by quick dispatch ${batchNumber} without a scan`,
                updatedAt: now,
              })
              .where(eq(wmsPickListItems.id, line.id));
          }
          for (const list of openLists) {
            await tx
              .update(wmsPickLists)
              .set({
                status: 'completed',
                completedAt: now,
                completedBy: ctx.user.id,
                updatedAt: now,
              })
              .where(eq(wmsPickLists.id, list.id));
          }
        }

        const pickListOrderIds = new Set(pickLists.map((list) => list.orderId));

        // Zoho orders
        if (zohoRows.length > 0) {
          await tx
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

          const [casesResult] = await tx
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

            // Picked on a pick list (complete or not) or marked picked: the
            // scanned lines already left the bay. Only an order that never
            // went to picking is taken off the shelf here.
            if (pickListOrderIds.has(row.id) || row.status === 'picked') continue;

            const items = await tx
              .select({
                lwin18: zohoSalesOrderItems.lwin18,
                sku: zohoSalesOrderItems.sku,
                name: zohoSalesOrderItems.name,
                quantity: zohoSalesOrderItems.quantity,
                unit: zohoSalesOrderItems.unit,
              })
              .from(zohoSalesOrderItems)
              .where(eq(zohoSalesOrderItems.salesOrderId, row.id));

            for (const item of items) {
              const lwin = item.lwin18 ?? item.sku;
              if (!lwin || item.quantity <= 0) continue;
              await drawLine({
                orderId: row.id,
                orderNumber: row.salesOrderNumber,
                lwin,
                productName: item.name,
                quantity: item.quantity,
                isBottleLine: /^bottle/i.test((item.unit ?? '').trim()),
                pack: null,
                preferOwnerId: null,
                allowPrefix: false,
              });
            }
          }
        }

        // PCO orders
        if (pcoRows.length > 0) {
          await tx
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

          const [casesResult] = await tx
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

            // Picked on a pick list: its scanned lines already left the bay
            if (pickListOrderIds.has(row.id) || completedOrderIds.has(row.id)) continue;

            const items = await tx
              .select({
                lwin: privateClientOrderItems.lwin,
                productName: privateClientOrderItems.productName,
                quantity: privateClientOrderItems.quantity,
                caseConfig: privateClientOrderItems.caseConfig,
              })
              .from(privateClientOrderItems)
              .where(eq(privateClientOrderItems.orderId, row.id));

            for (const item of items) {
              if (!item.lwin || item.quantity <= 0) continue;
              await drawLine({
                orderId: row.id,
                orderNumber: row.orderNumber,
                lwin: item.lwin,
                productName: item.productName,
                quantity: item.quantity,
                // A single-bottle line is caseConfig 1: its quantity is bottles
                isBottleLine: item.caseConfig === 1,
                pack: item.caseConfig ?? null,
                preferOwnerId: row.partnerId ?? null,
                allowPrefix: true,
              });
            }
          }
        }

        // Anything that would ship without leaving the shelf needs a yes
        if (problems.length > 0 && !confirmUnpicked) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Check before dispatching: ${problems.join('; ')}.`,
          });
        }

        if (batchOrderInserts.length > 0) {
          await tx.insert(wmsDispatchBatchOrders).values(batchOrderInserts);
        }

        const [updatedBatch] = await tx
          .update(wmsDispatchBatches)
          .set({
            orderCount: batchOrderInserts.length,
            totalCases,
            updatedAt: now,
          })
          .where(eq(wmsDispatchBatches.id, batchId))
          .returning();

        return { batch, updatedBatch, batchNumber, batchOrderInserts, totalCases };
      });

    const batchId = batch.id;

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
        addRandomSuffix: true,
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

    await announceDispatch(batch.id, 'dispatched');

    return {
      success: true,
      batch: updatedBatch ?? batch,
      deliveryNote,
      message: `Dispatched ${batchOrderInserts.length} orders (${totalCases} cases) as ${batchNumber}`,
    };
  });

export default adminQuickDispatch;
