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
 * Undo a manual-invoicing step, for a mistake
 *
 * `to: 'pending'` takes an invoice off the lines (back to Delivered – Manual
 * Invoice Pending); `to: 'none'` takes the delivered mark off. Logged on the
 * order's timeline with what was removed, so a corrected invoice number
 * leaves a trail.
 */
const adminResetItemInvoicing = adminProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      itemIds: z.array(z.string().uuid()).min(1),
      to: z.enum(['pending', 'none']),
    }),
  )
  .mutation(async ({ input, ctx: { user } }) => {
    if (!(await pcoInvoicingReady())) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Manual invoicing is not set up yet.' });
    }

    const [order] = await db
      .select({ partnerId: privateClientOrders.partnerId })
      .from(privateClientOrders)
      .where(eq(privateClientOrders.id, input.orderId));
    if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });

    const where = and(
      eq(pcoItemInvoicing.orderId, input.orderId),
      inArray(pcoItemInvoicing.itemId, input.itemIds),
    );
    const before = await db
      .select({
        invoiceNumber: pcoItemInvoicing.invoiceNumber,
        productName: privateClientOrderItems.productName,
      })
      .from(pcoItemInvoicing)
      .innerJoin(privateClientOrderItems, eq(privateClientOrderItems.id, pcoItemInvoicing.itemId))
      .where(where);

    if (input.to === 'none') {
      await db.delete(pcoItemInvoicing).where(where);
    } else {
      await db
        .update(pcoItemInvoicing)
        .set({ status: 'pending', invoiceNumber: null, invoiceDate: null, invoicedAt: null, invoicedBy: null, updatedAt: new Date() })
        .where(where);
    }

    await db.insert(privateClientOrderActivityLogs).values({
      orderId: input.orderId,
      userId: user.id,
      partnerId: order.partnerId,
      action: input.to === 'none' ? 'delivery_mark_removed' : 'manual_invoice_removed',
      notes:
        input.to === 'none'
          ? `Delivered mark removed: ${before.map((b) => b.productName).join(', ')}`
          : `Invoice removed (${[...new Set(before.map((b) => b.invoiceNumber).filter(Boolean))].join(', ') || 'none'}), back to Manual Invoice Pending: ${before.map((b) => b.productName).join(', ')}`,
      metadata: { itemIds: input.itemIds },
    });

    return { reset: before.length };
  });

export default adminResetItemInvoicing;
