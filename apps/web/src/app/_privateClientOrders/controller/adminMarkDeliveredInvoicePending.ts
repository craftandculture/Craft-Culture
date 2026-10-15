import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  pcoItemInvoicing,
  privateClientOrderActivityLogs,
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import pcoInvoicingReady from '../utils/pcoInvoicingReady';

/**
 * Mark lines delivered, with a manual invoice still to raise
 *
 * Some lines for a part delivery, or every line (no `itemIds`) when the whole
 * order has gone. Lines already invoiced are left alone and reported, never
 * reset to pending — that is how an invoice gets raised twice. The lines'
 * stock status moves to delivered, and the order's timeline records it.
 */
const adminMarkDeliveredInvoicePending = adminProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      itemIds: z.array(z.string().uuid()).optional(),
    }),
  )
  .mutation(async ({ input, ctx: { user } }) => {
    if (!(await pcoInvoicingReady())) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Manual invoicing is not set up yet — the database update has not run. Try again after the next deploy.',
      });
    }

    const [order] = await db
      .select({ id: privateClientOrders.id, partnerId: privateClientOrders.partnerId })
      .from(privateClientOrders)
      .where(eq(privateClientOrders.id, input.orderId));
    if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });

    const items = await db
      .select({ id: privateClientOrderItems.id, productName: privateClientOrderItems.productName })
      .from(privateClientOrderItems)
      .where(
        and(
          eq(privateClientOrderItems.orderId, input.orderId),
          input.itemIds?.length ? inArray(privateClientOrderItems.id, input.itemIds) : undefined,
        ),
      );
    if (items.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'None of those lines are on this order' });
    }

    const existing = await db
      .select({ itemId: pcoItemInvoicing.itemId, status: pcoItemInvoicing.status, invoiceNumber: pcoItemInvoicing.invoiceNumber })
      .from(pcoItemInvoicing)
      .where(inArray(pcoItemInvoicing.itemId, items.map((i) => i.id)));
    const invoiced = new Map(
      existing.filter((e) => e.status === 'invoiced').map((e) => [e.itemId, e.invoiceNumber]),
    );
    const alreadyPending = new Set(existing.filter((e) => e.status === 'pending').map((e) => e.itemId));

    const toMark = items.filter((i) => !invoiced.has(i.id) && !alreadyPending.has(i.id));

    if (toMark.length > 0) {
      await db.transaction(async (tx) => {
        await tx.insert(pcoItemInvoicing).values(
          toMark.map((item) => ({
            itemId: item.id,
            orderId: input.orderId,
            status: 'pending' as const,
            deliveredBy: user.id,
          })),
        );
        await tx
          .update(privateClientOrderItems)
          .set({ stockStatus: 'delivered', updatedAt: new Date() })
          .where(inArray(privateClientOrderItems.id, toMark.map((i) => i.id)));
        await tx.insert(privateClientOrderActivityLogs).values({
          orderId: input.orderId,
          userId: user.id,
          partnerId: order.partnerId,
          action: 'delivered_invoice_pending',
          notes: `Delivered – Manual Invoice Pending: ${toMark.map((i) => i.productName).join(', ')}`,
          metadata: { itemIds: toMark.map((i) => i.id) },
        });
      });
    }

    return {
      marked: toMark.length,
      alreadyPending: items.filter((i) => alreadyPending.has(i.id)).length,
      skippedInvoiced: items
        .filter((i) => invoiced.has(i.id))
        .map((i) => ({ productName: i.productName, invoiceNumber: invoiced.get(i.id) })),
    };
  });

export default adminMarkDeliveredInvoicePending;
